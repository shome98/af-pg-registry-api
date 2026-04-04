# AF PG Registry API Usage Guide

This guide explains how to consume the `af-pg-registry-api` from a frontend app or an LLM-driven client.

It is based on the current codebase, not just the README, so it reflects the actual routes, validation, auth behavior, and response shapes implemented in the server.

## What This API Does

This API stores and manages registry records for generated MongoDB CRUD APIs.

Each record represents one generated API configuration, including:

- metadata like `name`, `description`, `apiId`
- the generated endpoint list
- record/model definitions
- permission mode
- docs access flag
- encrypted MongoDB connection URI storage
- a one-time API key for the generated API

## Base URL

Default local base URL:

```txt
http://localhost:3001
```

Versioned API prefix:

```txt
/api/v1
```

Main resource base path:

```txt
/api/v1/mongo-apis
```

## Authentication

All `/api/v1/mongo-apis/*` routes require authentication.

Supported auth inputs:

- `Authorization: Bearer <jwt>`
- `access_token` cookie

Development-only shortcut:

- when `NODE_ENV=development`, the API also accepts:
  - `x-user-id`
  - `x-session-id`

This shortcut is useful when FE is under development and JWT wiring is not ready yet.

### JWT payload expectation

At minimum, the decoded token must contain:

```json
{
  "userId": "uuid-or-user-identifier"
}
```

Optional fields used by the app typings:

```json
{
  "sessionToken": "optional",
  "role": "optional"
}
```

## Global Response Shape

### Success

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {},
  "meta": {}
}
```

Notes:

- `data` is omitted when there is nothing to return
- `meta` is only present for paginated endpoints

### Error

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "path": "fieldName",
      "message": "Validation message"
    }
  ]
}
```

Notes:

- `errors` is usually present for validation failures
- the API uses HTTP status codes properly, so clients should branch on both `status` and `success`

## Health And Utility Routes

These routes do not require auth.

### `GET /`

Basic welcome and uptime response.

### `GET /healthz`

Health check.

### `GET /readyz`

Readiness check.

Example response:

```json
{
  "success": true,
  "message": "Registry API is healthy!",
  "data": {
    "status": "ok",
    "environment": "development",
    "timestamp": "2026-03-31T12:00:00.000Z",
    "uptime": "42s"
  }
}
```

## Main Resource Model

A `mongo-api` record returned by the API looks like this:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "apiId": "abc123def4567890",
  "name": "Products API",
  "description": "Catalog service",
  "apiKeyUpdatedAt": "2026-03-31T12:00:00.000Z",
  "dbName": "catalog_db",
  "dbUri": "mongodb://...",
  "databaseType": "MongoDB",
  "permission": "MCRUDQ",
  "recordDefinitions": [],
  "endpoints": ["/api/v2/temp/abc123def4567890/products"],
  "softDelete": false,
  "textIndexStrategy": "explicit",
  "hasDocsAccess": true,
  "provisionedUser": "mongo_user",
  "expirationTime": "2026-04-01T00:00:00.000Z",
  "isActive": true,
  "createdAt": "2026-03-31T12:00:00.000Z",
  "updatedAt": "2026-03-31T12:00:00.000Z"
}
```

Important:

- `apiKeyHash` is never returned
- `dbUri` is stored encrypted in PostgreSQL but returned decrypted by the API
- plaintext `apiKey` or `newApiKey` is only returned on create/regenerate responses

## Permission Modes

Allowed `permission` values:

- `SCRUD`
- `SCRUDQ`
- `MCRUD`
- `MCRUDQ`

Validation rule:

- `SCRUD` and `SCRUDQ` must contain exactly one `recordDefinitions` item

## Record Definition Format

Each `recordDefinitions` item must look like:

```json
{
  "record_name": "Product",
  "record_config": {
    "name": {
      "type": "String",
      "required": true,
      "searchable": true
    },
    "price": {
      "type": "Number",
      "required": true,
      "min": 0
    }
  }
}
```

Supported field types:

- `String`
- `Number`
- `Boolean`
- `Date`
- `ObjectId`
- `Mixed`

`record_name` rules:

- required
- max 64 chars
- must start with a letter
- only letters, digits, and underscores

## Endpoints

### 1. Create a registry record

`POST /api/v1/mongo-apis`

Rate limit:

- 20 requests per hour per IP

Required fields:

- `name`
- `permission`
- `recordDefinitions`
- `expirationTime`

Optional fields:

- `description`
- `apiId`
- `dbName`
- `dbUri`
- `databaseType` (`MongoDB` only)
- `softDelete`
- `textIndexStrategy`
- `hasDocsAccess`
- `provisionedUser`
- `endpoints`

Example request:

```json
{
  "name": "Products API",
  "description": "Catalog service",
  "permission": "MCRUDQ",
  "recordDefinitions": [
    {
      "record_name": "Product",
      "record_config": {
        "name": { "type": "String", "required": true, "searchable": true },
        "price": { "type": "Number", "required": true, "min": 0 }
      }
    }
  ],
  "dbName": "catalog_db",
  "dbUri": "mongodb://localhost:27017",
  "softDelete": false,
  "textIndexStrategy": "explicit",
  "hasDocsAccess": true,
  "endpoints": ["/api/v2/temp/abc123def4567890/products"],
  "expirationTime": "2026-04-01T00:00:00.000Z"
}
```

Success response:

```json
{
  "success": true,
  "message": "API record created! Store your API Key safely - it will NOT be shown again.",
  "data": {
    "id": "uuid",
    "apiId": "abc123def4567890",
    "name": "Products API",
    "apiKey": "one-time-plaintext-key",
    "permission": "MCRUDQ",
    "recordDefinitions": [],
    "expirationTime": "2026-04-01T00:00:00.000Z"
  }
}
```

Consumer note:

- store `data.apiKey` immediately because the server never returns it again

### 2. List my registry records

`GET /api/v1/mongo-apis`

Query params:

- `page` default `1`
- `limit` default `10`, max `100`
- `isActive` as string: `true` or `false`
- `search` searches `name` and `description`

Example:

```txt
GET /api/v1/mongo-apis?page=1&limit=20&isActive=true&search=product
```

Success response:

```json
{
  "success": true,
  "message": "Retrieved 2 API record(s).",
  "data": [{}, {}],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 3. Get one record by internal ID

`GET /api/v1/mongo-apis/:id`

Path param:

- `id` must be a UUID v4

Use this when your UI stores the registry row ID.

### 4. Get one record by generated API ID

`GET /api/v1/mongo-apis/by-api-id/:apiId`

Path param:

- `apiId` must be a 16-character lowercase hex string

Use this when the FE is keyed by the generated API identifier instead of the PostgreSQL row ID.

### 5. Update a record

`PATCH /api/v1/mongo-apis/:id`

This is a true partial update endpoint.
Only provided fields are changed.

Updatable fields:

- `name`
- `description`
- `dbName`
- `dbUri`
- `permission`
- `recordDefinitions`
- `softDelete`
- `textIndexStrategy`
- `hasDocsAccess`
- `provisionedUser`
- `endpoints`
- `expirationTime`
- `isActive`

Nullable-on-update fields:

- `description`
- `textIndexStrategy`
- `provisionedUser`

Example request:

```json
{
  "description": "Updated description",
  "hasDocsAccess": false,
  "textIndexStrategy": null
}
```

Consumer notes:

- at least one field is required
- `expirationTime` is coerced to a date on update, so ISO strings work well
- unlike create validation, update validation does not re-check the special `SCRUD`/`SCRUDQ` one-record rule

### 6. Soft delete a record

`DELETE /api/v1/mongo-apis/:id`

This does not remove the row.
It sets:

```json
{
  "isActive": false
}
```

Use this for reversible deactivation in UI flows.

### 7. Hard delete a record

`DELETE /api/v1/mongo-apis/:id/hard`

This permanently removes the record.

Success response:

```json
{
  "success": true,
  "message": "API record permanently deleted."
}
```

### 8. Regenerate API key

`POST /api/v1/mongo-apis/:id/regenerate-key`

Rate limit:

- 10 requests per hour per IP

Success response:

```json
{
  "success": true,
  "message": "API Key regenerated! Store your new API Key safely - it will NOT be shown again.",
  "data": {
    "id": "uuid",
    "newApiKey": "one-time-plaintext-key"
  }
}
```

Consumer note:

- store `newApiKey` immediately and replace the previous value everywhere

## Validation Rules That Matter In Clients

### Common string limits

- `name`: 1 to 100 chars
- `description`: max 500 chars
- `dbName`: 1 to 64 chars
- `provisionedUser`: max 128 chars
- `search`: max 100 chars

### `apiId`

- optional on create
- if omitted, server generates it
- if provided, must be lowercase 16-char hex, example:

```txt
abc123def4567890
```

### `dbUri`

- optional
- must be a valid URL when present

### `endpoints`

- optional array of strings
- defaults to `[]` on create

### `textIndexStrategy`

- allowed values: `wildcard`, `explicit`

### `databaseType`

- currently only `MongoDB`

## Error Handling Expectations

### Typical status codes

- `200` success
- `201` created
- `400` validation error / bad request
- `401` missing or invalid auth
- `404` record not found
- `409` duplicate record or foreign key conflict
- `429` rate limit hit
- `500` unexpected server error

### Example validation error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "path": "recordDefinitions",
      "message": "SCRUD and SCRUDQ permissions require exactly one record definition"
    }
  ]
}
```

### Duplicate conflict behavior

If a unique DB constraint fails, the API returns `409`.
This is most likely to happen for a duplicate `apiId`.

## Frontend Integration Example

```ts
const API_BASE = "http://localhost:3001/api/v1";

async function listMongoApis(token: string) {
  const res = await fetch(`${API_BASE}/mongo-apis?page=1&limit=10`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();

  if (!res.ok || !body.success) {
    throw new Error(body.message || "Failed to fetch records");
  }

  return body;
}
```

Create example:

```ts
async function createMongoApi(token: string, payload: unknown) {
  const res = await fetch(`${API_BASE}/mongo-apis`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();

  if (!res.ok || !body.success) {
    throw new Error(body.message || "Failed to create API record");
  }

  return body.data;
}
```

## LLM Consumer Tips

If an LLM is calling this API, these rules help a lot:

- always send `Authorization: Bearer <token>` unless you explicitly know you are in development mode with header bypass enabled
- treat `apiKey` and `newApiKey` as secrets that must be captured immediately
- use `GET /by-api-id/:apiId` when the conversation references the generated API ID
- use `PATCH` for partial edits instead of resending full records
- expect paginated list responses to include `meta`
- display field-level validation messages from `errors[]` directly to users

## Important Implementation Notes

- all CRUD routes are scoped to `req.user.userId`, so one user cannot access another user's records through these endpoints
- list and detail responses currently return decrypted `dbUri`; if FE should not see raw connection URIs, that behavior would need a backend change
- the API supports both local Postgres and Neon, but that does not change the HTTP contract
- the repo currently has no meaningful automated tests, so consumers should validate critical flows against a running environment

## Recommended FE Flow

1. Authenticate and get a JWT.
2. Call `GET /api/v1/mongo-apis` to render the registry list.
3. Use `POST /api/v1/mongo-apis` for create forms.
4. Persist the returned `apiKey` immediately.
5. Use `PATCH /api/v1/mongo-apis/:id` for edits.
6. Use soft delete by default, hard delete only behind a strong confirmation step.
7. Use regenerate-key only when the user explicitly rotates credentials.

