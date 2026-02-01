/**
 * Admin Authentication Middleware
 *
 * Verifies JWT tokens from HttpOnly cookies for admin dashboard routes.
 * Microsoft SSO is the ONLY authentication method.
 * Supports "Remember Me" with 30-day sessions.
 */

import { Request, Response, NextFunction, CookieOptions } from 'express';
import { verifyJwt, getCurrentUser, isAdmin, isSuperAdmin } from '../services/adminAuthService';
import { AdminContext, AdminRole } from '../types';

// Note: Express Request extension is declared in types/multiTenant.ts

// Cookie configuration
export const AUTH_COOKIE_NAME = 'admin_session';

// Session durations
const SESSION_DURATION_DEFAULT = 12 * 60 * 60 * 1000; // 12 hours
const SESSION_DURATION_REMEMBER = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Get cookie options based on remember me setting
 */
export function getAuthCookieOptions(rememberMe: boolean = false): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: rememberMe ? SESSION_DURATION_REMEMBER : SESSION_DURATION_DEFAULT,
    path: '/',
  };
}

// Export default cookie options for backward compatibility
export const AUTH_COOKIE_OPTIONS = getAuthCookieOptions(false);

/**
 * Extract JWT from cookie ONLY (no Authorization header fallback)
 */
function extractToken(req: Request): string | null {
  // Strictly check HttpOnly cookie only
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }
  return null;
}

/**
 * Middleware to verify admin JWT from cookie and attach admin context to request
 *
 * Usage:
 * router.use(adminAuth);
 * router.get('/organizations', (req, res) => {
 *   const { user_id, role } = req.admin!;
 *   // ...
 * });
 */
export async function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in with Microsoft.',
        code: 'NO_TOKEN',
      });
      return;
    }

    // Verify JWT
    const { valid, payload } = verifyJwt(token);

    if (!valid || !payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired session. Please sign in again.',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Get full user details
    const user = await getCurrentUser(token);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({
        success: false,
        error: 'User account is deactivated',
        code: 'USER_INACTIVE',
      });
      return;
    }

    // Attach admin context to request (using snake_case per AdminContext interface)
    req.admin = {
      user_id: user.user_id,
      email: user.email,
      role: user.role as AdminRole,
    };

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Optional admin auth - doesn't fail if no token provided
 * Useful for routes that can work with or without admin context
 */
export async function optionalAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (token) {
      const { valid, payload } = verifyJwt(token);

      if (valid && payload) {
        const user = await getCurrentUser(token);

        if (user && user.is_active) {
          req.admin = {
            user_id: user.user_id,
            email: user.email,
            role: user.role as AdminRole,
          };
        }
      }
    }

    next();
  } catch (error) {
    console.error('Optional admin auth error:', error);
    // Don't fail, just continue without admin context
    next();
  }
}

/**
 * Require admin role (admin or super_admin)
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.admin) {
    res.status(401).json({
      success: false,
      error: 'Admin authentication required',
      code: 'NO_ADMIN',
    });
    return;
  }

  // Get user for role check
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Admin authentication required',
      code: 'NO_ADMIN',
    });
    return;
  }

  const user = await getCurrentUser(token);
  if (!user || !isAdmin(user)) {
    res.status(403).json({
      success: false,
      error: 'Admin role required',
      code: 'NOT_ADMIN',
    });
    return;
  }

  next();
}

/**
 * Require super_admin role
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.admin) {
    res.status(401).json({
      success: false,
      error: 'Admin authentication required',
      code: 'NO_ADMIN',
    });
    return;
  }

  // Get user for role check
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Admin authentication required',
      code: 'NO_ADMIN',
    });
    return;
  }

  const user = await getCurrentUser(token);
  if (!user || !isSuperAdmin(user)) {
    res.status(403).json({
      success: false,
      error: 'Super admin role required',
      code: 'NOT_SUPER_ADMIN',
    });
    return;
  }

  next();
}

/**
 * Rate limiting for admin routes (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function adminRateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.admin?.user_id || req.ip || 'anonymous';
    const now = Date.now();

    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    entry.count++;
    next();
  };
}
