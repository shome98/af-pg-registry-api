import { and, eq, ilike, count, desc, or, SQL } from 'drizzle-orm';
import { db, mongoDbApis, type MongoDbApi, type NewMongoDbApi } from '../db';
import { ApiError } from '../utils/api-error';
import { generateApiKey, hashString, generateApiId } from '../utils/crypto';
import { encrypt, decrypt } from '../utils/encrypt';
import { env } from '../config/env';
import type {
  CreateMongoApiDto,
  UpdateMongoApiDto,
  PaginationDto,
} from '../validators/mongo-api.validator';

//  Return Types

export interface CreateApiResult {
  record: MongoDbApi;
  /** Plaintext API key — only returned ONCE at creation. Never stored. */
  apiKey: string;
}

export interface RegenerateKeyResult {
  record: MongoDbApi;
  /** New plaintext API key — only returned ONCE after regeneration. Never stored. */
  newApiKey: string;
}

export interface PaginatedResult {
  records: MongoDbApi[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

//  Helpers

/**
 * Encrypts the dbUri if present before persisting.
 * Decrypts on the way out in getById/getAll so controllers always get plaintext.
 */
function encryptDbUri(dbUri?: string | null): string | null | undefined {
  if (!dbUri) return dbUri;
  return encrypt(dbUri, env.ENCRYPTION_KEY);
}

function decryptDbUri(dbUri?: string | null): string | null | undefined {
  if (!dbUri) return dbUri;
  try {
    return decrypt(dbUri, env.ENCRYPTION_KEY);
  } catch {
    // If decryption fails (e.g. value was stored unencrypted), return as-is
    return dbUri;
  }
}

/** Strips apiKeyHash and decrypts dbUri before returning to the caller. */
function sanitizeRecord(
  record: MongoDbApi,
): Omit<MongoDbApi, 'apiKeyHash'> & { dbUri?: string | null } {
  const { apiKeyHash: _hash, ...rest } = record;
  return {
    ...rest,
    dbUri: (decryptDbUri(record.dbUri) ?? null) as string | null,
  };
}

//  Service Functions ──

/**
 * Creates a new MongoDbApi record.
 * Generates a fresh API key, stores its hash, and encrypts dbUri.
 * Returns the sanitized record plus the one-time plaintext API key.
 */
export async function createMongoApi(
  userId: string,
  dto: CreateMongoApiDto,
): Promise<CreateApiResult> {
  const apiKey = generateApiKey();
  const apiKeyHash = hashString(apiKey);
  const apiId = dto.apiId ?? generateApiId();

  const newRecord: NewMongoDbApi = {
    userId,
    apiId,
    name: dto.name,
    description: dto.description ?? null,
    apiKeyHash,
    apiKeyUpdatedAt: new Date(),
    dbName: dto.dbName ?? null,
    dbUri: encryptDbUri(dto.dbUri) as string | null,
    databaseType: (dto.databaseType as 'MongoDB') ?? 'MongoDB',
    permission: dto.permission as 'SCRUD' | 'SCRUDQ' | 'MCRUD' | 'MCRUDQ',
    recordDefinitions:
      dto.recordDefinitions as unknown as (typeof mongoDbApis.$inferInsert)['recordDefinitions'],
    endpoints: (dto.endpoints ??
      []) as unknown as (typeof mongoDbApis.$inferInsert)['endpoints'],
    softDelete: dto.softDelete ?? false,
    textIndexStrategy:
      (dto.textIndexStrategy as 'wildcard' | 'explicit' | null) ?? null,
    hasDocsAccess: dto.hasDocsAccess ?? false,
    provisionedUser: dto.provisionedUser ?? null,
    expirationTime: new Date(dto.expirationTime),
    isActive: true,
  };

  const [created] = await db.insert(mongoDbApis).values(newRecord).returning();

  if (!created) {
    throw ApiError.internal('💥 Failed to create API record');
  }

  return {
    record: { ...created, dbUri: decryptDbUri(created.dbUri) as string | null },
    apiKey,
  };
}

/**
 * Retrieves a single record by PG UUID, scoped to the requesting user.
 * Decrypts dbUri before returning.
 */
export async function getMongoApiById(
  id: string,
  userId: string,
): Promise<MongoDbApi> {
  const [record] = await db
    .select()
    .from(mongoDbApis)
    .where(and(eq(mongoDbApis.id, id), eq(mongoDbApis.userId, userId)))
    .limit(1);

  if (!record) {
    throw ApiError.notFound('🔍 API record not found.');
  }

  return { ...record, dbUri: decryptDbUri(record.dbUri) as string | null };
}

/**
 * Retrieves a single record by CrudFactory's apiId (16-hex-char string).
 * Scoped to the requesting user. Decrypts dbUri before returning.
 */
export async function getMongoApiByApiId(
  apiId: string,
  userId: string,
): Promise<MongoDbApi> {
  const [record] = await db
    .select()
    .from(mongoDbApis)
    .where(and(eq(mongoDbApis.apiId, apiId), eq(mongoDbApis.userId, userId)))
    .limit(1);

  if (!record) {
    throw ApiError.notFound('🔍 API record not found for the given apiId.');
  }

  return { ...record, dbUri: decryptDbUri(record.dbUri) as string | null };
}

/**
 * Returns a paginated list of API records for a user.
 * Supports filtering by isActive and full-text search on name/description.
 */
export async function getMongoApisByUser(
  userId: string,
  pagination: PaginationDto,
): Promise<PaginatedResult> {
  const { page, limit, isActive, search } = pagination;
  const offset = (page - 1) * limit;

  // Build WHERE conditions dynamically
  const conditions: SQL[] = [eq(mongoDbApis.userId, userId)];

  if (isActive !== undefined) {
    conditions.push(eq(mongoDbApis.isActive, isActive));
  }

  if (search) {
    const searchCondition = or(
      ilike(mongoDbApis.name, `%${search}%`),
      ilike(
        mongoDbApis.description as Parameters<typeof ilike>[0],
        `%${search}%`,
      ),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const whereClause = and(...conditions);

  const [records, totalResult] = await Promise.all([
    db
      .select()
      .from(mongoDbApis)
      .where(whereClause)
      .orderBy(desc(mongoDbApis.createdAt))
      .limit(limit)
      .offset(offset),

    db.select({ total: count() }).from(mongoDbApis).where(whereClause),
  ]);

  const total = Number(totalResult[0]?.total ?? 0);

  return {
    records: records.map((r) => ({
      ...r,
      dbUri: decryptDbUri(r.dbUri) as string | null,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Partially updates a MongoDbApi record.
 * Only fields present in the DTO are updated — true PATCH semantics.
 */
export async function updateMongoApi(
  id: string,
  userId: string,
  dto: UpdateMongoApiDto,
): Promise<MongoDbApi> {
  // Verify ownership — throws 404 if not found or unauthorized
  await getMongoApiById(id, userId);

  const updateData: Partial<NewMongoDbApi> = {
    updatedAt: new Date(),
  };

  if (dto.name !== undefined) updateData.name = dto.name;
  if (dto.description !== undefined) updateData.description = dto.description;
  if (dto.dbName !== undefined) updateData.dbName = dto.dbName;
  if (dto.dbUri !== undefined)
    updateData.dbUri = encryptDbUri(dto.dbUri) as string | null;
  if (dto.permission !== undefined)
    updateData.permission = dto.permission as
      | 'SCRUD'
      | 'SCRUDQ'
      | 'MCRUD'
      | 'MCRUDQ';
  if (dto.recordDefinitions !== undefined) {
    updateData.recordDefinitions =
      dto.recordDefinitions as unknown as (typeof mongoDbApis.$inferInsert)['recordDefinitions'];
  }
  if (dto.softDelete !== undefined) updateData.softDelete = dto.softDelete;
  if (dto.textIndexStrategy !== undefined) {
    updateData.textIndexStrategy = dto.textIndexStrategy as
      | 'wildcard'
      | 'explicit'
      | null;
  }
  if (dto.hasDocsAccess !== undefined)
    updateData.hasDocsAccess = dto.hasDocsAccess;
  if (dto.provisionedUser !== undefined)
    updateData.provisionedUser = dto.provisionedUser;
  if (dto.endpoints !== undefined) {
    updateData.endpoints =
      dto.endpoints as unknown as (typeof mongoDbApis.$inferInsert)['endpoints'];
  }
  if (dto.expirationTime !== undefined)
    updateData.expirationTime = new Date(dto.expirationTime);
  if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

  const [updated] = await db
    .update(mongoDbApis)
    .set(updateData)
    .where(and(eq(mongoDbApis.id, id), eq(mongoDbApis.userId, userId)))
    .returning();

  if (!updated) {
    throw ApiError.internal('💥 Failed to update API record.');
  }

  return { ...updated, dbUri: decryptDbUri(updated.dbUri) as string | null };
}

/**
 * Soft-deletes (deactivates) an API record.
 * Sets isActive = false without removing the row.
 */
export async function softDeleteMongoApi(
  id: string,
  userId: string,
): Promise<MongoDbApi> {
  await getMongoApiById(id, userId);

  const [updated] = await db
    .update(mongoDbApis)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(mongoDbApis.id, id), eq(mongoDbApis.userId, userId)))
    .returning();

  if (!updated) {
    throw ApiError.internal('💥 Failed to deactivate API record.');
  }

  return { ...updated, dbUri: decryptDbUri(updated.dbUri) as string | null };
}

/**
 * Permanently deletes an API record from the database.
 * Use with caution — prefer softDelete for recoverable deactivation.
 */
export async function hardDeleteMongoApi(
  id: string,
  userId: string,
): Promise<void> {
  await getMongoApiById(id, userId);

  await db
    .delete(mongoDbApis)
    .where(and(eq(mongoDbApis.id, id), eq(mongoDbApis.userId, userId)));
}

/**
 * Generates a brand-new API key, replaces the stored hash, and updates
 * apiKeyUpdatedAt. The new plaintext key is returned ONCE and never stored.
 */
export async function regenerateApiKey(
  id: string,
  userId: string,
): Promise<RegenerateKeyResult> {
  await getMongoApiById(id, userId);

  const newApiKey = generateApiKey();
  const newApiKeyHash = hashString(newApiKey);

  const [updated] = await db
    .update(mongoDbApis)
    .set({
      apiKeyHash: newApiKeyHash,
      apiKeyUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(mongoDbApis.id, id), eq(mongoDbApis.userId, userId)))
    .returning();

  if (!updated) {
    throw ApiError.internal('💥 Failed to regenerate API key.');
  }

  return {
    record: { ...updated, dbUri: decryptDbUri(updated.dbUri) as string | null },
    newApiKey,
  };
}

export { sanitizeRecord };
