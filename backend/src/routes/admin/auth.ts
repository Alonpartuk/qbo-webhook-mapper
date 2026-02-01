/**
 * Admin Authentication Routes
 *
 * Microsoft SSO is the ONLY authentication method.
 * Uses HttpOnly cookies for persistent sessions.
 * Supports "Remember Me" for 30-day sessions.
 */

import { Router, Request, Response } from 'express';
import {
  getCurrentUser,
  refreshJwt,
  verifyJwt,
} from '../../services/adminAuthService';
import {
  isMicrosoftSSOConfigured,
  getMicrosoftLoginUrl,
  handleMicrosoftCallback,
  getMicrosoftSSOStatus,
} from '../../services/microsoftAuthService';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '../../middleware/adminAuth';

const router = Router();

// Remember Me cookie (stores preference for 30 days)
const REMEMBER_ME_COOKIE = 'admin_remember_me';

/**
 * Helper to set auth cookie with appropriate expiration
 */
function setAuthCookie(res: Response, token: string, rememberMe: boolean = false): void {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions(rememberMe));
}

/**
 * Helper to clear auth cookie
 */
function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
}

// =============================================================================
// MICROSOFT SSO ROUTES (Primary Authentication)
// =============================================================================

/**
 * GET /api/admin/auth/status
 * Get authentication provider status
 */
router.get('/status', (req: Request, res: Response) => {
  const microsoftStatus = getMicrosoftSSOStatus();

  return res.json({
    success: true,
    data: {
      microsoft: microsoftStatus,
    },
  });
});

/**
 * GET /api/admin/auth/microsoft
 * Initiate Microsoft SSO login
 * Query params: ?rememberMe=true for 30-day session
 */
router.get('/microsoft', async (req: Request, res: Response) => {
  try {
    if (!isMicrosoftSSOConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Microsoft SSO is not configured',
      });
    }

    // Store remember me preference in cookie before redirect
    const rememberMe = req.query.rememberMe === 'true';
    if (rememberMe) {
      res.cookie(REMEMBER_ME_COOKIE, 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000, // 5 minutes (just for the OAuth flow)
      });
    }

    const { url, state } = await getMicrosoftLoginUrl();

    // Store state in cookie for verification
    res.cookie('msal_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000, // 5 minutes
    });

    return res.redirect(url);
  } catch (error) {
    console.error('Microsoft login initiation error:', error);
    const adminBaseUrl = process.env.ADMIN_BASE_URL || 'http://localhost:3000';
    return res.redirect(`${adminBaseUrl}/login?error=sso_init_failed`);
  }
});

/**
 * GET /api/admin/auth/microsoft/callback
 * Handle Microsoft OAuth callback
 * Sets HttpOnly cookie for persistent session
 */
router.get('/microsoft/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;
    const adminBaseUrl = process.env.ADMIN_BASE_URL || 'http://localhost:3000';

    if (error) {
      console.error('Microsoft OAuth error:', error, error_description);
      return res.redirect(`${adminBaseUrl}/login?error=${error}&message=${encodeURIComponent(String(error_description || ''))}`);
    }

    if (!code || !state) {
      return res.redirect(`${adminBaseUrl}/login?error=missing_params`);
    }

    // Check for remember me preference
    const rememberMe = req.cookies?.[REMEMBER_ME_COOKIE] === 'true';

    const result = await handleMicrosoftCallback(String(code), String(state), rememberMe);

    // Clear temporary cookies
    res.clearCookie('msal_state');
    res.clearCookie(REMEMBER_ME_COOKIE);

    if (result.success && result.jwt) {
      // Set HttpOnly cookie for persistent session
      setAuthCookie(res, result.jwt, rememberMe);
      // Redirect to dashboard (no token in URL needed)
      return res.redirect(`${adminBaseUrl}/admin/organizations`);
    }

    // Auth failed - redirect to login with error
    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }

    return res.redirect(`${adminBaseUrl}/login?error=auth_failed`);
  } catch (error) {
    console.error('Microsoft callback error:', error);
    const adminBaseUrl = process.env.ADMIN_BASE_URL || 'http://localhost:3000';
    return res.redirect(`${adminBaseUrl}/login?error=callback_failed`);
  }
});

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * GET /api/admin/auth/me
 * Get current authenticated user from session cookie
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Strictly check cookie only
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN',
      });
    }

    const user = await getCurrentUser(token);

    if (!user) {
      // Clear invalid cookie
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
});

/**
 * POST /api/admin/auth/logout
 * Clear session cookie and logout
 */
router.post('/logout', (req: Request, res: Response) => {
  clearAuthCookie(res);
  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * POST /api/admin/auth/refresh
 * Refresh session token (heartbeat)
 * Extends session by generating a new token with fresh expiration
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Get current token from cookie
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No session to refresh',
        code: 'NO_SESSION',
      });
    }

    // Verify current token is still valid
    const { valid, payload } = verifyJwt(token);

    if (!valid || !payload) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        error: 'Session expired, please login again',
        code: 'SESSION_EXPIRED',
      });
    }

    // Generate new token with fresh expiration
    const refreshResult = refreshJwt(token);

    if (!refreshResult.success || !refreshResult.jwt) {
      return res.status(401).json({
        success: false,
        error: 'Failed to refresh session',
        code: 'REFRESH_FAILED',
      });
    }

    // Set new cookie with same remember me setting
    setAuthCookie(res, refreshResult.jwt, refreshResult.rememberMe || false);

    return res.json({
      success: true,
      message: 'Session refreshed',
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh session',
    });
  }
});

export default router;
