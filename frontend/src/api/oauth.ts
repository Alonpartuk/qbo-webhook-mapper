/**
 * Legacy OAuth API (DEPRECATED)
 *
 * Global OAuth is no longer supported.
 * QuickBooks connections are now managed per-organization.
 *
 * Use the admin API for per-organization connections:
 * - GET /api/v1/connect/:clientSlug - Get OAuth authorization URL
 * - GET /api/v1/org/:clientSlug/status - Get connection status
 * - POST /api/v1/org/:clientSlug/disconnect - Disconnect from QBO
 */

// These functions are deprecated and will throw errors if called
export function getAuthorizationUrl(): string {
  console.warn('DEPRECATED: Use per-organization OAuth via /api/v1/connect/:clientSlug');
  throw new Error('Global OAuth is deprecated. Use per-organization connections.');
}

export async function getConnectionStatus(): Promise<{ connected: false }> {
  console.warn('DEPRECATED: Use per-organization status via /api/v1/org/:clientSlug/status');
  return { connected: false };
}

export async function disconnect(): Promise<void> {
  console.warn('DEPRECATED: Use per-organization disconnect via /api/v1/org/:clientSlug/disconnect');
  throw new Error('Global OAuth is deprecated. Use per-organization connections.');
}

export async function refreshToken(): Promise<void> {
  console.warn('DEPRECATED: Token refresh is handled automatically per-organization');
  throw new Error('Global OAuth is deprecated. Token refresh is automatic.');
}
