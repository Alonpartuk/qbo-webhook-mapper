/**
 * Request Logger Middleware
 *
 * Captures API usage metrics for security auditing and analytics:
 * - Organization ID (from tenant context)
 * - API Key ID (from apiKeyContext)
 * - Endpoint and method
 * - Status code and error codes
 * - Response latency
 * - IP address
 */

import { Request, Response, NextFunction } from 'express';
import { logApiUsage } from '../services/usageLoggingService';

/**
 * Extract error code from response body if available
 */
function extractErrorCode(res: Response): string | undefined {
  // Try to get error code from response locals
  if (res.locals.errorCode) {
    return res.locals.errorCode;
  }

  // Map status codes to generic error codes
  if (res.statusCode === 401) return 'ERR_UNAUTHORIZED';
  if (res.statusCode === 403) return 'ERR_FORBIDDEN';
  if (res.statusCode === 404) return 'ERR_NOT_FOUND';
  if (res.statusCode === 429) return 'ERR_RATE_LIMITED';
  if (res.statusCode >= 500) return 'ERR_SERVER_ERROR';

  return undefined;
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  // Check for forwarded headers (when behind proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
    return ips.split(',')[0].trim();
  }

  // Check for real IP header
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }

  // Fall back to socket address
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Request logger middleware
 *
 * Usage:
 * app.use('/api/v1/org/:slug/proxy', requestLogger);
 * app.use('/api/v1/webhook', requestLogger);
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture request size
  const requestSize = req.headers['content-length']
    ? parseInt(req.headers['content-length'], 10)
    : undefined;

  // Store original end function
  const originalEnd = res.end;
  let responseSize: number | undefined;

  // Override end to capture response size
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.end = function (this: Response, chunk?: any, encoding?: any, callback?: any): Response {
    if (chunk) {
      if (typeof chunk === 'string') {
        responseSize = Buffer.byteLength(chunk);
      } else if (Buffer.isBuffer(chunk)) {
        responseSize = chunk.length;
      }
    }

    // Restore original end
    res.end = originalEnd;

    // Call original end
    return originalEnd.call(this, chunk, encoding, callback);
  };

  // Log when response finishes
  res.on('finish', () => {
    const responseTimeMs = Date.now() - startTime;

    // Build query params string (excluding sensitive data)
    const queryParams = Object.keys(req.query).length > 0
      ? JSON.stringify(
          Object.fromEntries(
            Object.entries(req.query).filter(
              ([key]) => !['api_key', 'token', 'secret'].includes(key.toLowerCase())
            )
          )
        )
      : undefined;

    // Log asynchronously (fire and forget)
    logApiUsage({
      timestamp: new Date(),
      organization_id: req.tenant?.organization_id,
      api_key_id: req.apiKeyContext?.key_id,
      endpoint: req.path,
      method: req.method,
      query_params: queryParams,
      status_code: res.statusCode,
      response_time_ms: responseTimeMs,
      request_size_bytes: requestSize,
      response_size_bytes: responseSize,
      error_code: res.statusCode >= 400 ? extractErrorCode(res) : undefined,
      user_agent: req.headers['user-agent'],
      ip_address: getClientIp(req),
    }).catch((err) => {
      // Don't let logging errors affect the response
      console.error('[RequestLogger] Failed to log usage:', err);
    });
  });

  next();
}

/**
 * Error code setter helper
 * Use in route handlers to set specific error codes for logging
 *
 * Example:
 * res.locals.errorCode = 'ERR_KEY_ORG_MISMATCH';
 * res.status(403).json({ error: 'API key mismatch' });
 */
export function setErrorCode(res: Response, code: string): void {
  res.locals.errorCode = code;
}
