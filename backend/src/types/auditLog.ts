/**
 * Audit Log Types
 *
 * Type definitions for the comprehensive audit logging system.
 * Supports tracking of all platform actions with non-blocking async logging.
 */

/**
 * Categories of audit events
 */
export type AuditCategory =
  | 'auth'           // Login, logout, password changes
  | 'user_mgmt'      // User CRUD operations
  | 'api_key'        // API key creation, rotation, revocation, usage
  | 'qbo'            // QBO OAuth, token refresh, API calls
  | 'webhook'        // Webhook received, processed, failed
  | 'organization'   // Organization CRUD
  | 'mapping'        // Mapping configuration changes
  | 'system';        // System-level events

/**
 * Specific action types within each category
 */
export type AuditAction =
  // Auth actions
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | 'password_reset'
  // User management actions
  | 'user_created'
  | 'user_updated'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'user_deleted'
  // API key actions
  | 'api_key_created'
  | 'api_key_used'
  | 'api_key_rotated'
  | 'api_key_revoked'
  | 'api_key_expired'
  // QBO actions
  | 'qbo_connect_started'
  | 'qbo_connect_success'
  | 'qbo_connect_failed'
  | 'qbo_disconnect'
  | 'qbo_token_refresh'
  | 'qbo_token_refresh_failed'
  | 'qbo_api_call'
  | 'qbo_api_error'
  // Webhook actions
  | 'webhook_received'
  | 'webhook_processed'
  | 'webhook_failed'
  | 'webhook_invalid'
  // Organization actions
  | 'org_created'
  | 'org_updated'
  | 'org_deactivated'
  // Mapping actions
  | 'mapping_created'
  | 'mapping_updated'
  | 'mapping_deleted'
  | 'template_created'
  | 'template_updated'
  // System actions
  | 'system_error'
  | 'rate_limit_exceeded';

/**
 * Result status of an audit event
 */
export type AuditResult = 'success' | 'failure' | 'error';

/**
 * Core audit log entry structure
 */
export interface AuditLog {
  log_id: string;
  timestamp: Date;
  category: AuditCategory;
  action: AuditAction;
  result: AuditResult;

  // Actor information (who performed the action)
  actor_type: 'admin_user' | 'api_key' | 'system' | 'anonymous';
  actor_id: string | null;        // user_id, api_key_id, or null
  actor_email: string | null;     // For admin users
  actor_ip: string | null;

  // Target information (what was affected)
  target_type: string | null;     // 'user', 'organization', 'api_key', 'webhook', etc.
  target_id: string | null;
  organization_id: string | null;

  // Additional context
  details: Record<string, unknown>;  // Sanitized metadata
  error_message: string | null;
  user_agent: string | null;
  request_path: string | null;
  request_method: string | null;
}

/**
 * Input for creating a new audit log entry
 */
export interface AuditLogInput {
  category: AuditCategory;
  action: AuditAction;
  result: AuditResult;

  actor_type: AuditLog['actor_type'];
  actor_id?: string | null;
  actor_email?: string | null;
  actor_ip?: string | null;

  target_type?: string | null;
  target_id?: string | null;
  organization_id?: string | null;

  details?: Record<string, unknown>;
  error_message?: string | null;
  user_agent?: string | null;
  request_path?: string | null;
  request_method?: string | null;
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  // Time range
  start_date?: Date;
  end_date?: Date;

  // Filter by category/action
  category?: AuditCategory | AuditCategory[];
  action?: AuditAction | AuditAction[];
  result?: AuditResult;

  // Filter by actor
  actor_type?: AuditLog['actor_type'];
  actor_id?: string;
  actor_email?: string;

  // Filter by target
  target_type?: string;
  target_id?: string;
  organization_id?: string;

  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Response structure for paginated audit log queries
 */
export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Fields that should be sanitized (removed/masked) from audit details
 */
export const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'new_password',
  'old_password',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'secret',
  'client_secret',
  'authorization',
  'cookie',
  'x-api-key',
] as const;

/**
 * Configuration for the audit log service
 */
export interface AuditLogConfig {
  /** Interval in milliseconds to flush the queue (default: 5000ms) */
  flushIntervalMs: number;
  /** Maximum queue size before forced flush (default: 100) */
  maxQueueSize: number;
  /** Whether to log to console in development (default: true in dev) */
  consoleLogging: boolean;
  /** Retention period in days (default: 90) */
  retentionDays: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_AUDIT_CONFIG: AuditLogConfig = {
  flushIntervalMs: 5000,
  maxQueueSize: 100,
  consoleLogging: process.env.NODE_ENV === 'development',
  retentionDays: 90,
};
