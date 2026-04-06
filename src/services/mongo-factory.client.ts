import { env } from '../config/env';
import { ApiError } from '../utils/api-error';
import type { CorsPolicy } from '../types/crud-factory.types';

function clip(text: string, max = 300): string {
  const t = (text ?? '').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export async function patchApiCorsPolicy(
  apiId: string,
  corsPolicy: CorsPolicy,
  forwardHeaders: {
    authorization?: string;
    cookie?: string;
    'x-user-id'?: string;
    'x-session-id'?: string;
  },
): Promise<void> {
  const url = `${env.MONGO_FACTORY_BASE_URL}/api/${env.MONGO_FACTORY_API_VERSION}/apis/${apiId}/policy`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (forwardHeaders.authorization)
    headers.Authorization = forwardHeaders.authorization;
  if (forwardHeaders.cookie) headers.Cookie = forwardHeaders.cookie;
  if (forwardHeaders['x-user-id']) headers['x-user-id'] = forwardHeaders['x-user-id'];
  if (forwardHeaders['x-session-id'])
    headers['x-session-id'] = forwardHeaders['x-session-id'];

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ corsPolicy }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err: any) {
    throw ApiError.internal(
      `💥 Failed to reach api-factory-mongo: ${err?.message ?? String(err)}`,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const status = response.status >= 500 ? 502 : response.status;
    throw new ApiError(
      status,
      `api-factory-mongo responded ${response.status}: ${clip(text) || response.statusText}`,
    );
  }
}

