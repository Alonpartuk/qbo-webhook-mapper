/**
 * Audit Log Service
 *
 * Non-blocking async logging service for comprehensive platform auditing.
 * Features:
 * - In-memory queue with 5-second flush interval
 * - Automatic sanitization of sensitive data
 * - Fail-safe design (never crashes on errors)
 * - 90-day retention with BigQuery partitioning
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AuditLog,
  AuditLogInput,
  AuditLogFilters,
  AuditLogResponse,
  AuditLogConfig,
  DEFAULT_AUDIT_CONFIG,
  SENSITIVE_FIELDS,
} from '../types/auditLog';
import * as dataService from './dataService';

// In-memory queue for non-blocking logging
let auditQueue: AuditLog[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let config: AuditLogConfig = { ...DEFAULT_AUDIT_CONFIG };

/**
 * Initialize the audit log service with optional configuration
 */
export function initAuditService(customConfig?: Partial<AuditLogConfig>): void {
  config = { ...DEFAULT_AUDIT_CONFIG, ...customConfig };

  // Start the flush timer
  if (flushTimer) {
    clearInterval(flushTimer);
  }

  flushTimer = setInterval(() => {
    flush().catch((err) => {
      console.error('[AuditLog] Flush error (non-fatal):', err.message);
    });
  }, config.flushIntervalMs);

  if (config.consoleLogging) {
    console.log('[AuditLog] Service initialized with config:', {
      flushIntervalMs: config.flushIntervalMs,
      maxQueueSize: config.maxQueueSize,
      retentionDays: config.retentionDays,
    });
  }
}

/**
 * Shutdown the audit log service gracefully
 * Call this when the application is shutting down
 */
export async function shutdownAuditService(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  // Final flush before shutdown
  await flush();

  if (config.consoleLogging) {
    console.log('[AuditLog] Service shutdown complete');
  }
}

/**
 * Sanitize sensitive data from an object
 * Recursively removes/masks sensitive fields
 */
export function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized: Record<string, unknown> = { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();

    // Check if this key is sensitive
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Recursively sanitize nested objects
    const value = sanitized[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitize(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitize(item as Record<string, unknown>)
          : item
      );
    }
  }

  return sanitized;
}

/**
 * Log an audit event (non-blocking)
 * This function returns immediately and queues the log for async processing
 */
export function log(input: AuditLogInput): void {
  try {
    const auditLog: AuditLog = {
      log_id: uuidv4(),
      timestamp: new Date(),
      category: input.category,
      action: input.action,
      result: input.result,
      actor_type: input.actor_type,
      actor_id: input.actor_id ?? null,
      actor_email: input.actor_email ?? null,
      actor_ip: input.actor_ip ?? null,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      organization_id: input.organization_id ?? null,
      details: input.details ? sanitize(input.details) : {},
      error_message: input.error_message ?? null,
      user_agent: input.user_agent ?? null,
      request_path: input.request_path ?? null,
      request_method: input.request_method ?? null,
    };

    auditQueue.push(auditLog);

    // Console logging in development
    if (config.consoleLogging) {
      console.log(
        `[AuditLog] ${auditLog.category}:${auditLog.action} - ${auditLog.result}`,
        auditLog.actor_email || auditLog.actor_id || 'anonymous'
      );
    }

    // Force flush if queue exceeds max size
    if (auditQueue.length >= config.maxQueueSize) {
      flush().catch((err) => {
        console.error('[AuditLog] Force flush error (non-fatal):', err.message);
      });
    }
  } catch (err) {
    // Fail-safe: never crash on logging errors
    console.error('[AuditLog] Error creating log entry (non-fatal):', err);
  }
}

/**
 * Flush the audit queue to persistent storage
 * This is called automatically by the timer and can be called manually
 */
export async function flush(): Promise<void> {
  if (auditQueue.length === 0) {
    return;
  }

  // Grab the current queue and reset it
  const logsToFlush = [...auditQueue];
  auditQueue = [];

  try {
    await dataService.insertAuditLogs(logsToFlush);

    if (config.consoleLogging) {
      console.log(`[AuditLog] Flushed ${logsToFlush.length} log entries`);
    }
  } catch (err) {
    // On failure, put logs back in queue (at the front)
    // But only if queue is not already full to prevent memory issues
    if (auditQueue.length < config.maxQueueSize * 2) {
      auditQueue = [...logsToFlush, ...auditQueue];
      console.error(`[AuditLog] Flush failed, ${logsToFlush.length} logs re-queued:`, err);
    } else {
      console.error(`[AuditLog] Flush failed and queue full, ${logsToFlush.length} logs lost:`, err);
    }
  }
}

/**
 * Query audit logs with filters
 */
export async function queryLogs(filters: AuditLogFilters): Promise<AuditLogResponse> {
  try {
    return await dataService.queryAuditLogs(filters);
  } catch (err) {
    console.error('[AuditLog] Query error:', err);
    throw err;
  }
}

/**
 * Get the current queue size (for monitoring)
 */
export function getQueueSize(): number {
  return auditQueue.length;
}

/**
 * Helper: Log an authentication event
 */
export function logAuth(
  action: 'login_success' | 'login_failed' | 'logout' | 'password_change' | 'password_reset',
  result: 'success' | 'failure',
  options: {
    userId?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
  }
): void {
  log({
    category: 'auth',
    action,
    result,
    actor_type: options.userId ? 'admin_user' : 'anonymous',
    actor_id: options.userId,
    actor_email: options.email,
    actor_ip: options.ip,
    user_agent: options.userAgent,
    error_message: options.errorMessage,
    details: options.details,
  });
}

/**
 * Helper: Log a user management event
 */
export function logUserMgmt(
  action:
    | 'user_created'
    | 'user_updated'
    | 'user_deactivated'
    | 'user_reactivated'
    | 'user_deleted',
  result: 'success' | 'failure' | 'error',
  options: {
    actorId: string;
    actorEmail: string;
    targetUserId: string;
    targetEmail?: string;
    ip?: string;
    userAgent?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
  }
): void {
  log({
    category: 'user_mgmt',
    action,
    result,
    actor_type: 'admin_user',
    actor_id: options.actorId,
    actor_email: options.actorEmail,
    actor_ip: options.ip,
    user_agent: options.userAgent,
    target_type: 'user',
    target_id: options.targetUserId,
    error_message: options.errorMessage,
    details: {
      ...options.details,
      target_email: options.targetEmail,
    },
  });
}

/**
 * Helper: Log an API key event
 */
export function logApiKey(
  action:
    | 'api_key_created'
    | 'api_key_used'
    | 'api_key_rotated'
    | 'api_key_revoked'
    | 'api_key_expired',
  result: 'success' | 'failure' | 'error',
  options: {
    actorType: 'admin_user' | 'api_key' | 'system';
    actorId?: string;
    actorEmail?: string;
    apiKeyId: string;
    organizationId?: string;
    ip?: string;
    userAgent?: string;
    requestPath?: string;
    requestMethod?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
  }
): void {
  log({
    category: 'api_key',
    action,
    result,
    actor_type: options.actorType,
    actor_id: options.actorId,
    actor_email: options.actorEmail,
    actor_ip: options.ip,
    user_agent: options.userAgent,
    target_type: 'api_key',
    target_id: options.apiKeyId,
    organization_id: options.organizationId,
    request_path: options.requestPath,
    request_method: options.requestMethod,
    error_message: options.errorMessage,
    details: options.details,
  });
}

/**
 * Helper: Log a QBO event
 */
export function logQbo(
  action:
    | 'qbo_connect_started'
    | 'qbo_connect_success'
    | 'qbo_connect_failed'
    | 'qbo_disconnect'
    | 'qbo_token_refresh'
    | 'qbo_token_refresh_failed'
    | 'qbo_api_call'
    | 'qbo_api_error',
  result: 'success' | 'failure' | 'error',
  options: {
    actorType: 'admin_user' | 'api_key' | 'system';
    actorId?: string;
    actorEmail?: string;
    organizationId?: string;
    ip?: string;
    userAgent?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
  }
): void {
  log({
    category: 'qbo',
    action,
    result,
    actor_type: options.actorType,
    actor_id: options.actorId,
    actor_email: options.actorEmail,
    actor_ip: options.ip,
    user_agent: options.userAgent,
    organization_id: options.organizationId,
    error_message: options.errorMessage,
    details: options.details,
  });
}

/**
 * Helper: Log a webhook event
 */
export function logWebhook(
  action: 'webhook_received' | 'webhook_processed' | 'webhook_failed' | 'webhook_invalid',
  result: 'success' | 'failure' | 'error',
  options: {
    organizationId?: string;
    sourceId?: string;
    webhookPayloadId?: string;
    ip?: string;
    userAgent?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
  }
): void {
  log({
    category: 'webhook',
    action,
    result,
    actor_type: 'system',
    actor_ip: options.ip,
    user_agent: options.userAgent,
    organization_id: options.organizationId,
    target_type: 'webhook',
    target_id: options.webhookPayloadId || options.sourceId,
    error_message: options.errorMessage,
    details: {
      ...options.details,
      source_id: options.sourceId,
      payload_id: options.webhookPayloadId,
    },
  });
}

// Auto-initialize on import (can be reconfigured later)
// Wrapped in try-catch to prevent startup crashes
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  try {
    initAuditService();
  } catch (err) {
    console.error('[AuditLog] Failed to initialize (non-fatal):', err);
  }
}
