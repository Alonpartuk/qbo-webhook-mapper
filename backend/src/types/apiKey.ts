/**
 * API Key Types for Developer Platform
 *
 * Defines types for multi-level API key management:
 * - Tenant keys: Scoped to a specific organization
 * - Global admin keys: System-wide access for monitoring
 */

/**
 * API Key type - tenant-scoped or global admin
 */
export type ApiKeyType = 'tenant' | 'global_admin';

/**
 * Rate limit tier for API keys
 */
export type RateLimitTier = 'standard' | 'premium' | 'unlimited';

/**
 * API Key permissions structure
 */
export interface ApiKeyPermissions {
  /** Allowed endpoint patterns (e.g., ['proxy:read', 'webhooks:*']) */
  endpoints: string[];
  /** Rate limit tier for this key */
  rate_limit_tier?: RateLimitTier;
  /** Optional IP whitelist */
  ip_whitelist?: string[];
}

/**
 * API Key stored in database
 */
export interface ApiKey {
  key_id: string;
  organization_id: string | null; // NULL for global admin keys
  key_hash: string;               // SHA256 hash of full key
  key_prefix: string;             // Last 4 chars for display ("...1234")
  name: string;
  key_type: ApiKeyType;
  permissions: ApiKeyPermissions | null;
  is_active: boolean;
  created_at: Date;
  created_by: string | null;
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  revoked_by: string | null;
  grace_period_ends_at: Date | null; // For key rotation
}

/**
 * API Key creation input
 */
export interface CreateApiKeyInput {
  organization_id?: string | null;
  name: string;
  key_type: ApiKeyType;
  permissions?: ApiKeyPermissions;
  created_by?: string;
  expires_at?: Date;
}

/**
 * API Key creation result (includes the actual key - shown only once)
 */
export interface CreateApiKeyResult {
  key_id: string;
  key: string;            // Full key - ONLY returned once at creation
  key_prefix: string;     // Last 4 chars for future reference
  name: string;
  key_type: ApiKeyType;
  organization_id: string | null;
  created_at: Date;
  expires_at: Date | null;
}

/**
 * API Key validation result
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  key?: ApiKey;
  error?: string;
}

/**
 * API Key context attached to request
 */
export interface ApiKeyContext {
  key_id: string;
  organization_id: string | null;
  key_type: ApiKeyType;
  permissions: ApiKeyPermissions | null;
  rate_limit_tier: RateLimitTier;
}

/**
 * API Usage Log entry
 */
export interface ApiUsageLog {
  log_id: string;
  timestamp: Date;
  organization_id: string | null;
  api_key_id: string | null;
  endpoint: string;
  method: string;
  query_params: Record<string, unknown> | null;
  status_code: number;
  response_time_ms: number;
  request_size_bytes: number | null;
  response_size_bytes: number | null;
  error_code: string | null;
  user_agent: string | null;
  ip_address: string | null;
}

/**
 * API Usage statistics
 */
export interface ApiUsageStats {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_response_time_ms: number;
  endpoints: Array<{
    endpoint: string;
    count: number;
    avg_response_time_ms: number;
  }>;
}

/**
 * API Key list item (for display - never includes hash)
 */
export interface ApiKeyListItem {
  key_id: string;
  name: string;
  key_prefix: string;     // "...1234"
  key_type: ApiKeyType;
  organization_id: string | null;
  is_active: boolean;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
}

// Extend Express Request to include API key context
declare global {
  namespace Express {
    interface Request {
      apiKeyContext?: ApiKeyContext;
    }
  }
}
