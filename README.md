# 🏭 CRUD Factory Registry API

A production-grade **PostgreSQL-backed registry** for storing, managing, and retrieving [CRUD Factory](../crud_factory-clean-mongo-25feb26-shome) MongoDB API configurations.

When CrudFactory spins up a dynamic API (models, endpoints, permissions, TTL), this service persists that configuration durably — surviving server restarts, Redis flushes, and scaling events.

---

## ✨ Features

- 🔐 **API Key security** — plaintext key returned **once** at creation; only SHA-256 hash stored
- 🔒 **AES-256-GCM encryption** — `dbUri` (contains credentials) encrypted at rest
- 🗄️ **Dual DB support** — local PostgreSQL or [Neon](https://neon.tech) serverless (toggle via `DB_TYPE`)
- ✅ **Full Zod validation** — request body, query params, and path params all validated
- 🛡️ **JWT authentication** — every route protected by Bearer token middleware
- ♻️ **Key regeneration** — invalidate and replace an API key at any time
- 🗑️ **Soft + hard delete** — deactivate records without losing audit history
- 📄 **Pagination + search** — list endpoint supports `page`, `limit`, `isActive`, `search`
- 💥 **Global error handler** — handles `ApiError`, Zod errors, PG constraint violations
- ⏳ **Rate limiting** — global limiter + stricter limits on create (20/hr) and key regeneration (10/hr)

---

## 🗂️ Project Structure

```
src/
├── app.ts                        # Express app (middleware, routes, 404, error handler)
├── server.ts                     # Bootstrap: DB ping → listen → graceful shutdown
│
├── config/
│   ├── env.ts                    # Zod-parsed environment variables (fails fast)
│   └── constants.ts              # App-wide constants (API prefix, limits)
│
├── db/
│   ├── index.ts                  # Drizzle + pg Pool (local & Neon)
│   ├── migrate.ts                # Migration runner (ts-node)
│   └── schema/
│       └── mongo-api.schema.ts   # MongoDbApis table definition + enums + inferred types
│
├── types/
│   ├── express.d.ts              # Augments req.user with AuthUser
│   └── crud-factory.types.ts     # Mirror of CrudFactory's core types
│
├── utils/
│   ├── api-error.ts              # ApiError class with static factories
│   ├── api-response.ts           # sendSuccess / sendError response helpers
│   ├── crypto.ts                 # generateApiKey, hashString, timingSafeCompare
│   └── encrypt.ts                # AES-256-GCM encrypt/decrypt for dbUri
│
├── validators/
│   └── mongo-api.validator.ts    # Zod schemas: create, update, pagination, params
│
├── middleware/
│   ├── authenticate.ts           # JWT Bearer token middleware
│   ├── error-handler.ts          # Global error handler (last middleware)
│   ├── rate-limiter.ts           # global / createApi / regenerateKey limiters
│   └── validate.ts               # Zod validation middleware factory
│
├── services/
│   └── mongo-api.service.ts      # All DB operations via Drizzle ORM
│
├── controllers/
│   └── mongo-api.controller.ts   # Express handlers (strips apiKeyHash from responses)
│
└── routes/
    └── mongo-api.routes.ts       # Route definitions with middleware chains
```

---

## 🗃️ Database Schema — `MongoDbApis`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Auto-generated via `gen_random_uuid()` |
| `userId` | `uuid` | Owner (references your auth system) |
| `apiId` | `varchar(32)` UNIQUE | CrudFactory's 16-hex-char route ID |
| `name` | `varchar(100)` | Human-readable label |
| `description` | `text` | Optional |
| `apiKeyHash` | `varchar(64)` | SHA-256 of plaintext key — never stored raw |
| `apiKeyUpdatedAt` | `timestamp` | Tracks key regenerations |
| `dbName` | `varchar(64)` | MongoDB database name |
| `dbUri` | `text` | AES-256-GCM **encrypted** connection URI |
| `databaseType` | `enum` | `MongoDB` (extensible) |
| `permission` | `enum` | `SCRUD \| SCRUDQ \| MCRUD \| MCRUDQ` |
| `recordDefinitions` | `jsonb` | Full `RecordDefinition[]` model schema |
| `endpoints` | `jsonb` | Generated route paths array |
| `softDelete` | `boolean` | Default `false` |
| `textIndexStrategy` | `enum` | `wildcard \| explicit` (nullable) |
| `hasDocsAccess` | `boolean` | Default `false` |
| `provisionedUser` | `varchar(128)` | MongoDB provisioned username (nullable) |
| `expirationTime` | `timestamp` | When this API config expires |
| `isActive` | `boolean` | Default `true` — soft-delete flag |
| `createdAt` | `timestamp` | Auto |
| `updatedAt` | `timestamp` | Auto |

**Indexes:** `userId`, `isActive`, `expirationTime`, composite `(userId, isActive)`, unique `apiId`

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the required values:

```env
# PostgreSQL connection (local or Neon)
DATABASE_URL=postgresql://postgres:password@localhost:5432/crud_factory_registry
DB_TYPE=local          # "local" or "neon"

# JWT — must be ≥ 32 characters
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_32chars

# AES-256-GCM key — must be EXACTLY 32 characters
ENCRYPTION_KEY=your_32_char_encryption_key_here!!
```

### 3. Generate & run migrations

```bash
# Generate SQL migration files from schema
npm run db:generate

# Apply migrations to your database
npm run db:migrate
```

### 4. Start the server

```bash
# Development (hot reload)
npm run dev

# Production
npm run build && npm start
```

---

## 🔌 API Reference

**Base URL:** `http://localhost:3001/api/v1`

All routes require: `Authorization: Bearer <jwt_token>`

---

### `POST /mongo-apis`
Register a new CrudFactory API configuration.

**Rate limit:** 20 requests / hour per IP

**Request body:**
```json
{
  "name": "My Products API",
  "description": "E-commerce product catalog",
  "permission": "MCRUDQ",
  "recordDefinitions": [
    {
      "record_name": "Product",
      "record_config": {
        "name":  { "type": "String", "required": true, "searchable": true },
        "price": { "type": "Number", "required": true },
        "inStock": { "type": "Boolean", "default": true }
      }
    }
  ],
  "dbName": "ecommerce_db",
  "dbUri": "mongodb://localhost:27017",
  "softDelete": false,
  "textIndexStrategy": "explicit",
  "hasDocsAccess": true,
  "endpoints": ["/api/v2/temp/abc123def456ab12/products"],
  "expirationTime": "2026-04-01T00:00:00.000Z"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "🚀 API record created! Store your API Key safely — it will NOT be shown again.",
  "data": {
    "id": "uuid",
    "apiId": "abc123def456ab12",
    "name": "My Products API",
    "apiKey": "plaintext_key_shown_once_only",
    "apiKeyUpdatedAt": "...",
    "..."
  }
}
```

> ⚠️ `apiKey` is returned **only once**. Store it immediately.

---

### `GET /mongo-apis`
List all API records for the authenticated user (paginated).

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Records per page (max 100) |
| `isActive` | `true\|false` | — | Filter by active status |
| `search` | string | — | Search in `name` and `description` |

**Response `200`:**
```json
{
  "success": true,
  "message": "✅ Retrieved 3 API record(s).",
  "data": [...],
  "meta": { "total": 3, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### `GET /mongo-apis/:id`
Retrieve a single record by its PostgreSQL UUID.

---

### `GET /mongo-apis/by-api-id/:apiId`
Retrieve a single record by CrudFactory's own `apiId` (16-hex string).

---

### `PATCH /mongo-apis/:id`
Partially update a record. Only fields present in the body are updated.

**Updatable fields:** `name`, `description`, `dbName`, `dbUri`, `permission`, `recordDefinitions`, `softDelete`, `textIndexStrategy`, `hasDocsAccess`, `provisionedUser`, `endpoints`, `expirationTime`, `isActive`

---

### `DELETE /mongo-apis/:id`
**Soft-delete** — sets `isActive = false`. Record is preserved for audit purposes.

---

### `DELETE /mongo-apis/:id/hard`
**Hard delete** — permanently removes the record. Irreversible.

---

### `POST /mongo-apis/:id/regenerate-key`
Generate a new API key. The old key is immediately invalidated.

**Rate limit:** 10 requests / hour per IP

**Response `200`:**
```json
{
  "success": true,
  "message": "🔑 API Key regenerated! Store your new API Key safely — it will NOT be shown again.",
  "data": {
    "id": "uuid",
    "apiKeyUpdatedAt": "2026-03-04T...",
    "newApiKey": "new_plaintext_key_shown_once_only",
    "..."
  }
}
```

> ⚠️ `newApiKey` is returned **only once**. Store it immediately.

---

### `GET /health`
Health check — no auth required.

```json
{
  "success": true,
  "message": "💚 CRUD Factory Registry API is healthy!",
  "data": { "status": "ok", "environment": "development", "uptime": "42s" }
}
```

---

## 🔧 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with nodemon hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run db:generate` | Generate Drizzle migration files from schema |
| `npm run db:migrate` | Apply pending migrations to the database |
| `npm run db:push` | Push schema directly (no migration files — dev only) |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |

---

## 🌐 Neon (Serverless PostgreSQL)

To use [Neon](https://neon.tech):

1. Create a project at [neon.tech](https://neon.tech) and copy the connection string
2. Update `.env`:
```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/crud_factory_registry?sslmode=require
DB_TYPE=neon
```

SSL is automatically enabled when `DB_TYPE=neon`.

---

## 🔐 Security Notes

| Concern | Approach |
|---|---|
| API Key storage | SHA-256 hash stored — plaintext **never** persisted |
| API Key exposure | Returned **once** only (creation / regeneration) |
| `dbUri` (contains credentials) | AES-256-GCM encrypted at rest in the DB |
| Authentication | JWT Bearer token on every route |
| Brute-force | Rate limiting on all routes + tighter limits on sensitive ops |
| HTTP headers | `helmet` sets secure HTTP headers globally |

---

## 🧩 Extending the API

The project is structured for easy modification:

- **New fields** → add to `src/db/schema/mongo-api.schema.ts`, regenerate migrations, update the Zod validator and service
- **New routes** → add to `src/routes/mongo-api.routes.ts` + new controller method
- **New database type** (e.g. Postgres, MySQL) → extend `databaseTypeEnum` in schema and update validators
- **Admin operations** → add an `admin.routes.ts` + `authorize.ts` middleware (role from JWT payload)
- **Audit log** → add an `AuditLog` table and call it from the service layer
