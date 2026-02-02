/**
 * API Key Authentication Middleware
 *
 * Validates API keys from the X-API-Key header and attaches
 * the key context to the request for downstream handlers.
 *
 * Supports:
 * - Tenant-scoped keys (organization-specific)
 * - Global admin keys (system-wide access)
 * - Permission checking for specific operations
 * - Hybrid auth (API key OR JWT)
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  validateApiKey,
  hasPermission,
  getRateLimitTier,
} from '../services/apiKeyService';
import { ApiKeyContext, ApiKeyType } from '../types/apiKey';
import { setErrorCode } from './requestLogger';
import * as auditLog from '../services/auditLogService';

// Header name for API key
const API_KEY_HEADER = 'x-api-key';

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): string | null {
  // Check header (case-insensitive)
  const headerKey = req.headers[API_KEY_HEADER] as string;
  if (headerKey) {
    return headerKey;
  }

  // Check query parameter as fallback (not recommended for production)
  const queryKey = req.query.api_key as string;
  if (queryKey) {
    console.warn('[ApiKeyAuth] API key passed via query parameter - use header instead');
    return queryKey;
  }

  return null;
}

/**
 * Build API key context from validated key
 */
function buildKeyContext(apiKey: NonNullable<Awaited<ReturnType<typeof validateApiKey>>['key']>): ApiKeyContext {
  return {
    key_id: apiKey.key_id,
    organization_id: apiKey.organization_id,
    key_type: apiKey.key_type,
    permissions: apiKey.permissions,
    rate_limit_tier: getRateLimitTier(apiKey),
  };
}

/**
 * Middleware: Require API key authentication
 *
 * @param allowedTypes - Optional array of allowed key types (default: all types)
 */
export function requireApiKey(
  allowedTypes?: ApiKeyType[]
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = extractApiKey(req);

    if (!key) {
      setErrorCode(res, 'ERR_API_KEY_REQUIRED');
      res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'ERR_API_KEY_REQUIRED',
      });
      return;
    }

    const validation = await validateApiKey(key);

    if (!validation.valid || !validation.key) {
      setErrorCode(res, 'ERR_INVALID_API_KEY');

      // Log failed API key usage
      auditLog.logApiKey('api_key_used', 'failure', {
        actorType: 'api_key',
        apiKeyId: 'unknown',
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestPath: req.path,
        requestMethod: req.method,
        errorMessage: validation.error || 'Invalid API key',
      });

      res.status(401).json({
        success: false,
        error: validation.error || 'Invalid API key',
        code: 'ERR_INVALID_API_KEY',
      });
      return;
    }

    // Check if key type is allowed
    if (allowedTypes && !allowedTypes.includes(validation.key.key_type)) {
      setErrorCode(res, 'ERR_KEY_TYPE_NOT_ALLOWED');

      // Log unauthorized key type usage
      auditLog.logApiKey('api_key_used', 'failure', {
        actorType: 'api_key',
        apiKeyId: validation.key.key_id,
        organizationId: validation.key.organization_id || undefined,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestPath: req.path,
        requestMethod: req.method,
        errorMessage: `Key type '${validation.key.key_type}' not allowed`,
      });

      res.status(403).json({
        success: false,
        error: `API key type '${validation.key.key_type}' not allowed for this endpoint`,
        code: 'ERR_KEY_TYPE_NOT_ALLOWED',
      });
      return;
    }

    // Log successful API key usage
    auditLog.logApiKey('api_key_used', 'success', {
      actorType: 'api_key',
      apiKeyId: validation.key.key_id,
      organizationId: validation.key.organization_id || undefined,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      requestPath: req.path,
      requestMethod: req.method,
    });

    // Attach context to request
    req.apiKeyContext = buildKeyContext(validation.key);
    next();
  };
}

/**
 * Middleware: Require API key OR JWT authentication
 *
 * Useful for endpoints that should be accessible via either auth method.
 * Checks API key first, then falls back to JWT if present.
 */
export function requireApiKeyOrJwt(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = extractApiKey(req);

    // Try API key first
    if (apiKey) {
      const validation = await validateApiKey(apiKey);

      if (validation.valid && validation.key) {
        req.apiKeyContext = buildKeyContext(validation.key);
        next();
        return;
      }
      // If API key is present but invalid, don't fall back to JWT
      res.status(401).json({
        success: false,
        error: validation.error || 'Invalid API key',
        code: 'ERR_INVALID_API_KEY',
      });
      return;
    }

    // Check for JWT (req.admin would be set by adminAuth middleware)
    // If this middleware is used, adminAuth should have run first
    if (req.admin) {
      next();
      return;
    }

    // No valid auth found
    res.status(401).json({
      success: false,
      error: 'Authentication required (API key or JWT)',
      code: 'ERR_AUTH_REQUIRED',
    });
  };
}

/**
 * Middleware: Optional API key authentication
 *
 * Attaches key context if present and valid, but doesn't fail if missing.
 */
export function optionalApiKey(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = extractApiKey(req);

    if (key) {
      const validation = await validateApiKey(key);

      if (validation.valid && validation.key) {
        req.apiKeyContext = buildKeyContext(validation.key);
      }
      // Don't fail on invalid key - just don't attach context
    }

    next();
  };
}

/**
 * Middleware: Check permission for specific operation
 *
 * Must be used after requireApiKey middleware.
 *
 * @param operation - Operation to check (e.g., 'proxy:read', 'webhooks:write')
 */
export function requirePermission(operation: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKeyContext) {
      res.status(401).json({
        success: false,
        error: 'API key context not found',
        code: 'ERR_NO_KEY_CONTEXT',
      });
      return;
    }

    // Get the full key to check permissions
    // Note: We'd need to store the key object or re-fetch it
    // For now, check if permissions array includes the operation
    const permissions = req.apiKeyContext.permissions;

    if (!permissions) {
      res.status(403).json({
        success: false,
        error: 'API key has no permissions',
        code: 'ERR_NO_PERMISSIONS',
      });
      return;
    }

    const hasAccess =
      permissions.endpoints.includes('*') ||
      permissions.endpoints.includes(operation) ||
      permissions.endpoints.includes(`${operation.split(':')[0]}:*`);

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: `Permission denied for operation: ${operation}`,
        code: 'ERR_PERMISSION_DENIED',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: Ensure API key belongs to specified organization
 *
 * For tenant-scoped endpoints that need to verify the key matches the org.
 * Must be used after requireApiKey middleware.
 */
export function requireKeyForOrganization(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKeyContext) {
      res.status(401).json({
        success: false,
        error: 'API key context not found',
        code: 'ERR_NO_KEY_CONTEXT',
      });
      return;
    }

    // Global admin keys can access any org
    if (req.apiKeyContext.key_type === 'global_admin') {
      next();
      return;
    }

    // Tenant keys must match the organization from the route
    const routeOrgId = req.tenant?.organization_id;
    const keyOrgId = req.apiKeyContext.organization_id;

    if (!routeOrgId) {
      // No org in route - can't verify
      next();
      return;
    }

    if (keyOrgId !== routeOrgId) {
      setErrorCode(res, 'ERR_KEY_ORG_MISMATCH');
      res.status(403).json({
        success: false,
        error: 'API key does not belong to this organization',
        code: 'ERR_KEY_ORG_MISMATCH',
      });
      return;
    }

    next();
  };
}
