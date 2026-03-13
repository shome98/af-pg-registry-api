import { Request, Response, NextFunction } from 'express';
import * as service from '../services/mongo-api.service';
import { sendSuccess } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import type { PaginationDto } from '../validators/mongo-api.validator';
import type { MongoDbApi } from '../db';

//  Helper

/** Strips apiKeyHash from a record before sending to client. */
function toSafeRecord(record: MongoDbApi): Omit<MongoDbApi, 'apiKeyHash'> {
  const { apiKeyHash: _hash, ...safe } = record;
  return safe;
}

//  Controllers

/**
 * POST /mongo-apis
 * Creates a new MongoDbApi registry entry and returns the one-time API key.
 */
export async function createMongoApi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());

    const result = await service.createMongoApi(userId, req.body);

    sendSuccess(
      res,
      '🚀 API record created! Store your API Key safely — it will NOT be shown again.',
      {
        ...toSafeRecord(result.record),
        apiKey: result.apiKey, // one-time plaintext
      },
      201,
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /mongo-apis
 * Returns paginated list of the authenticated user's API records.
 */
export async function getMyMongoApis(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());

    const pagination = req.query as unknown as PaginationDto;
    const { records, total, page, limit, totalPages } =
      await service.getMongoApisByUser(userId, pagination);

    sendSuccess(
      res,
      `✅ Retrieved ${records.length} API record(s).`,
      records.map(toSafeRecord),
      200,
      { total, page, limit, totalPages },
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /mongo-apis/:id
 * Retrieves a single API record by its PG UUID (scoped to the current user).
 */
export async function getMongoApiById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());

    const record = await service.getMongoApiById(String(req.params.id), userId);
    sendSuccess(res, '✅ API record retrieved.', toSafeRecord(record));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /mongo-apis/by-api-id/:apiId
 * Retrieves a single API record by CrudFactory's own apiId (16-hex string).
 */
export async function getMongoApiByApiId(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());

    const record = await service.getMongoApiByApiId(
      String(req.params.apiId),
      userId,
    );
    sendSuccess(res, '✅ API record retrieved.', toSafeRecord(record));
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /mongo-apis/:id
 * Partially updates an API record (true PATCH semantics — only provided fields updated).
 */
export async function updateMongoApi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());

    const record = await service.updateMongoApi(
      String(req.params.id),
      userId,
      req.body,
    );
    sendSuccess(
      res,
      '✏️ API record updated successfully.',
      toSafeRecord(record),
    );
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /mongo-apis/:id
 * Soft-deletes (deactivates) an API record by setting isActive = false.
 * The record is preserved in the database for audit purposes.
 */
export async function deleteMongoApi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());

    const record = await service.softDeleteMongoApi(
      String(req.params.id),
      userId,
    );
    sendSuccess(
      res,
      '🗑️ API record deactivated successfully.',
      toSafeRecord(record),
    );
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /mongo-apis/:id/hard
 * Permanently removes a record from the database. Irreversible.
 */
export async function hardDeleteMongoApi(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());

    await service.hardDeleteMongoApi(String(req.params.id), userId);
    sendSuccess(res, '🗑️ API record permanently deleted.');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /mongo-apis/:id/regenerate-key
 * Generates a new API key, stores its hash, invalidates the old key.
 * Returns the new plaintext key ONCE — it will not be retrievable again.
 */
export async function regenerateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return void next(ApiError.unauthorized());

    const result = await service.regenerateApiKey(
      String(req.params.id),
      userId,
    );

    sendSuccess(
      res,
      '🔑 API Key regenerated! Store your new API Key safely — it will NOT be shown again.',
      {
        ...toSafeRecord(result.record),
        newApiKey: result.newApiKey, // one-time plaintext
      },
    );
  } catch (err) {
    next(err);
  }
}
