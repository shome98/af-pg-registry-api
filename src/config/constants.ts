export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

export const ALLOWED_PERMISSIONS = ["SCRUD", "SCRUDQ", "MCRUD", "MCRUDQ"] as const;
export const ALLOWED_TEXT_INDEX_STRATEGIES = ["wildcard", "explicit"] as const;
export const ALLOWED_DATABASE_TYPES = ["MongoDB"] as const;

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// Prefix tag used when logging API key creation events
export const API_KEY_LOG_TAG = "[API_KEY]";
