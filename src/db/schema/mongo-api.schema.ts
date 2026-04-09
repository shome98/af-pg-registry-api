import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { CorsPolicy } from '../../types/crud-factory.types';

// Enums

export const permissionEnum = pgEnum('api_permission', [
  'SCRUD',
  'SCRUDQ',
  'MCRUD',
  'MCRUDQ',
]);

export const textIndexStrategyEnum = pgEnum('text_index_strategy', [
  'wildcard',
  'explicit',
]);

export const databaseTypeEnum = pgEnum('database_type', ['MongoDB']);

//JSON types (mirrors CrudFactory's RecordDefinition)

export interface RecordDefinition {
  record_name: string;
  record_config: Record<string, unknown>;
}

//Table

export const mongoDbApis = pgTable(
  'MongoDbApis',
  {
    // Identity
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** Owner — maps to the user in the auth system */
    userId: uuid('userId').notNull(),

    /**
     * CrudFactory's own 16-hex-char identifier.
     * Used in route paths: /api/v2/temp/:apiId/...
     */
    apiId: varchar('apiId', { length: 32 }).notNull().unique(),

    /** Human-friendly label for this API config */
    name: varchar('name', { length: 100 }).notNull(),

    /** Optional longer description */
    description: text('description'),

    // Auth & Security

    /** SHA-256 hash of the plaintext API key — never store the raw key */
    apiKeyHash: varchar('apiKeyHash', { length: 64 }).notNull(),

    /** Tracks when the API key was last generated/regenerated */
    apiKeyUpdatedAt: timestamp('apiKeyUpdatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),

    //  MongoDB Connection

    /** MongoDB database name (e.g. "myapp_db") */
    dbName: varchar('dbName', { length: 64 }),

    /**
     * AES-256-GCM encrypted MongoDB connection URI.
     * May contain embedded provisioned credentials — always encrypted at rest.
     */
    dbUri: text('dbUri'),

    /** Reserved for future database types */
    databaseType: databaseTypeEnum('databaseType').notNull().default('MongoDB'),

    //  API Configuration (mirrors CrudFactory's ApiConfig)

    /** SCRUD | SCRUDQ | MCRUD | MCRUDQ */
    permission: permissionEnum('permission').notNull(),

    /**
     * Full RecordDefinition array — the complete model schema config
     * that CrudFactory uses to build Mongoose models.
     */
    recordDefinitions: jsonb('recordDefinitions')
      .$type<RecordDefinition[]>()
      .notNull(),

    /** Generated endpoint paths, e.g. ["/api/v2/temp/:apiId/products"] */
    endpoints: jsonb('endpoints').$type<string[]>().notNull().default([]),

    /** Whether soft-delete (isDeleted flag) is enabled on this API's models */
    softDelete: boolean('softDelete').notNull().default(false),

    /** "wildcard" = index all string fields | "explicit" = index marked fields */
    textIndexStrategy: textIndexStrategyEnum('textIndexStrategy'),

    //  Access Control

    /** Whether Swagger/docs UI is accessible for this API */
    hasDocsAccess: boolean('hasDocsAccess').notNull().default(false),

    /**
     * Per-API CORS policy (mirrors CrudFactory's corsPolicy).
     * When missing/null, clients should treat it as allow-all ("*").
     */
    corsPolicy: jsonb('corsPolicy').$type<CorsPolicy | null>(),

    /**
     * MongoDB username provisioned specifically for this API's dbName.
     * Password is already baked into the encrypted dbUri — only username stored here.
     */
    provisionedUser: varchar('provisionedUser', { length: 128 }),

    //  Lifecycle

    /** When this API configuration expires (maps to CrudFactory's TTL) */
    expirationTime: timestamp('expirationTime', {
      withTimezone: true,
    }).notNull(),

    /** Soft delete / deactivation flag. Defaults to active. */
    isActive: boolean('isActive').notNull().default(true),

    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },

  (table) => [
    index('idx_mongo_apis_userId').on(table.userId),
    index('idx_mongo_apis_isActive').on(table.isActive),
    index('idx_mongo_apis_expirationTime').on(table.expirationTime),
    index('idx_mongo_apis_userId_isActive').on(table.userId, table.isActive),
    uniqueIndex('uq_mongo_apis_apiId').on(table.apiId),
  ],
);

//Inferred Types ───────────────────────────────────────────────────────────

export type MongoDbApi = typeof mongoDbApis.$inferSelect;
export type NewMongoDbApi = typeof mongoDbApis.$inferInsert;
