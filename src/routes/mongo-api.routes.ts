import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  createApiRateLimiter,
  regenerateKeyRateLimiter,
} from '../middleware/rate-limiter';
import {
  createMongoApiSchema,
  updateMongoApiSchema,
  paginationSchema,
  uuidParamSchema,
  apiIdParamSchema,
} from '../validators/mongo-api.validator';
import * as controller from '../controllers/mongo-api.controller';

const router = Router();

//  All routes require a valid JWT
router.use(authenticate);

//  CRUD Routes

/**
 * POST /api/v1/mongo-apis
 * Register a new CrudFactory API configuration.
 * Rate limited: 20 creations per hour per IP.
 */
router.post(
  '/',
  createApiRateLimiter,
  validate(createMongoApiSchema),
  controller.createMongoApi,
);

/**
 * GET /api/v1/mongo-apis
 * List all API records for the authenticated user.
 * Supports: ?page=1&limit=10&isActive=true&search=products
 */
router.get('/', validate(paginationSchema, 'query'), controller.getMyMongoApis);

/**
 * GET /api/v1/mongo-apis/by-api-id/:apiId
 * Look up a record by CrudFactory's own apiId (16-hex string).
 * Must be placed BEFORE /:id to avoid param conflicts.
 */
router.get(
  '/by-api-id/:apiId',
  validate(apiIdParamSchema, 'params'),
  controller.getMongoApiByApiId,
);

/**
 * GET /api/v1/mongo-apis/:id
 * Retrieve a single record by its PG UUID.
 */
router.get(
  '/:id',
  validate(uuidParamSchema, 'params'),
  controller.getMongoApiById,
);

/**
 * PATCH /api/v1/mongo-apis/:id
 * Partially update a record (name, description, permission, dbUri, etc.).
 * Only fields present in the request body are updated.
 */
router.patch(
  '/:id',
  validate(uuidParamSchema, 'params'),
  validate(updateMongoApiSchema),
  controller.updateMongoApi,
);

/**
 * DELETE /api/v1/mongo-apis/:id
 * Soft-delete (deactivate) a record. Sets isActive = false.
 */
router.delete(
  '/:id',
  validate(uuidParamSchema, 'params'),
  controller.deleteMongoApi,
);

/**
 * DELETE /api/v1/mongo-apis/:id/hard
 * Permanently remove a record from the database. Irreversible.
 */
router.delete(
  '/:id/hard',
  validate(uuidParamSchema, 'params'),
  controller.hardDeleteMongoApi,
);

/**
 * POST /api/v1/mongo-apis/:id/regenerate-key
 * Generate a new API key for this record. Old key is immediately invalidated.
 * Rate limited: 10 regenerations per hour per IP.
 */
router.post(
  '/:id/regenerate-key',
  regenerateKeyRateLimiter,
  validate(uuidParamSchema, 'params'),
  controller.regenerateApiKey,
);

export default router;
