import { z } from 'zod';

//  Field-level schemas (mirrors CrudFactory's Zod validation)

const SUPPORTED_FIELD_TYPES = [
  'String',
  'Number',
  'Boolean',
  'Date',
  'ObjectId',
  'Mixed',
] as const;

const fieldSchemaZ: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.enum([...SUPPORTED_FIELD_TYPES], {
      message: `type must be one of: ${SUPPORTED_FIELD_TYPES.join(', ')}`,
    }),
    required: z.boolean().optional(),
    unique: z.boolean().optional(),
    ref: z.string().min(1).optional(),
    enum: z.array(z.string()).min(1).optional(),
    default: z.unknown().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    message: z.string().max(300).optional(),
    select: z.boolean().optional(),
    match: z.string().max(200).optional(),
    searchable: z.literal(true).optional(),
  }),
);

const recordConfigValueZ: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    fieldSchemaZ,
    z.array(fieldSchemaZ).min(1),
    z.array(recordConfigZ).min(1),
    recordConfigZ,
  ]),
);

const recordConfigZ: z.ZodType<unknown> = z.lazy(() =>
  z
    .record(
      z.string().min(1).max(64, 'Field name must be ≤ 64 characters'),
      recordConfigValueZ,
    )
    .refine((obj) => Object.keys(obj).length > 0, {
      message: 'record_config must have at least one field',
    }),
);

const recordDefinitionZ = z.object({
  record_name: z
    .string()
    .min(1, 'record_name is required')
    .max(64, 'record_name must be ≤ 64 characters')
    .regex(
      /^[A-Za-z][A-Za-z0-9_]*$/,
      'record_name must start with a letter and contain only letters, digits, and underscores',
    ),
  record_config: recordConfigZ,
});

//  Per-API CORS policy (mirrors api-factory-mongo corsPolicy)

export const corsPolicySchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('any'),
    credentials: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal('allowlist'),
    allowOrigins: z.array(z.string().min(1).max(300)).min(1),
    credentials: z.boolean().optional(),
  }),
]);

//  Create Schema

export const createMongoApiSchema = z
  .object({
    /** Human-readable label for this API config */
    name: z
      .string()
      .min(1, 'name is required')
      .max(100, 'name must be ≤ 100 characters'),

    description: z
      .string()
      .max(500, 'description must be ≤ 500 characters')
      .optional(),

    /**
     * CrudFactory's own apiId (16 hex chars).
     * If omitted the registry generates one automatically.
     */
    apiId: z
      .string()
      .regex(/^[0-9a-f]{16}$/, 'apiId must be a 16-character hex string')
      .optional(),

    dbName: z.string().min(1).max(64).optional(),
    dbUri: z.url('dbUri must be a valid URL').optional(),

    databaseType: z.enum(['MongoDB']).default('MongoDB'),

    permission: z.enum(['SCRUD', 'SCRUDQ', 'MCRUD', 'MCRUDQ'], {
      message: 'permission must be one of: SCRUD, SCRUDQ, MCRUD, MCRUDQ',
    }),

    recordDefinitions: z
      .array(recordDefinitionZ)
      .min(1, 'At least one record definition is required')
      .max(20, 'Maximum 20 record definitions allowed'),

    softDelete: z.boolean().default(false),

    textIndexStrategy: z
      .enum(['wildcard', 'explicit'], {
        message: "textIndexStrategy must be 'wildcard' or 'explicit'",
      })
      .optional(),

    hasDocsAccess: z.boolean().default(false),

    rateLimit: z.number().int().positive().default(10000),

    /**
     * Per-API CORS policy. If omitted, treat as allow-all ("*").
     * (Mirrors CrudFactory's corsPolicy)
     */
    corsPolicy: corsPolicySchema.optional(),

    /** Provisioned MongoDB username (if CrudFactory created one) */
    provisionedUser: z.string().max(128).optional(),

    /** Generated endpoint paths, e.g. ["/api/v2/temp/{apiId}/products"] */
    endpoints: z.array(z.string()).optional().default([]),

    /** ISO 8601 datetime string for when this API expires */
    expirationTime: z.string().datetime({
      message: 'expirationTime must be a valid ISO 8601 datetime',
    }),
  })
  .refine(
    (data) => {
      // SCRUD/SCRUDQ require exactly one model definition — same rule as CrudFactory
      if (data.permission === 'SCRUD' || data.permission === 'SCRUDQ') {
        return data.recordDefinitions.length === 1;
      }
      return true;
    },
    {
      message:
        'SCRUD and SCRUDQ permissions require exactly one record definition',
      path: ['recordDefinitions'],
    },
  );

//  Update Schema

export const updateMongoApiSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    dbName: z.string().min(1).max(64).optional(),
    dbUri: z.url('dbUri must be a valid URL').optional(),
    permission: z.enum(['SCRUD', 'SCRUDQ', 'MCRUD', 'MCRUDQ']).optional(),
    recordDefinitions: z.array(recordDefinitionZ).min(1).max(20).optional(),
    softDelete: z.boolean().optional(),
    textIndexStrategy: z.enum(['wildcard', 'explicit']).nullable().optional(),
    hasDocsAccess: z.boolean().optional(),
    rateLimit: z.number().int().positive().optional(),
    corsPolicy: corsPolicySchema.nullable().optional(),
    provisionedUser: z.string().max(128).nullable().optional(),
    endpoints: z.array(z.string()).optional(),
    expirationTime: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: '❌ At least one field must be provided for update',
  });

export const updateCorsPolicySchema = z
  .object({
    corsPolicy: corsPolicySchema.nullable().optional(),
    corsList: z.array(z.string().min(1).max(300)).optional(),
    credentials: z.boolean().optional(),
  })
  .refine((v) => v.corsPolicy !== undefined || v.corsList !== undefined, {
    message: 'At least one of corsPolicy or corsList must be provided',
  });

//  Query / Pagination Schema

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().max(100).optional(),
});

//  Param Schemas ─

export const uuidParamSchema = z.object({
  id: z.uuid({ version: 'v4', message: 'id must be a valid UUID' }),
});

export const apiIdParamSchema = z.object({
  apiId: z
    .string()
    .regex(/^[0-9a-f]{16}$/, 'apiId must be a 16-character hex string'),
});

//  Inferred Types

export type CreateMongoApiDto = z.infer<typeof createMongoApiSchema>;
export type UpdateMongoApiDto = z.infer<typeof updateMongoApiSchema>;
export type PaginationDto = z.infer<typeof paginationSchema>;
export type UpdateCorsPolicyDto = z.infer<typeof updateCorsPolicySchema>;
