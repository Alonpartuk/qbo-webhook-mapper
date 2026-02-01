/**
 * Admin Authentication Routes
 *
 * Supports multiple authentication methods:
 * - Microsoft SSO (primary, recommended)
 * - Magic link (fallback/development)
 */

import { Router, Request, Response } from 'express';
import {
  requestMagicLink,
  verifyMagicLink,
  getCurrentUser,
} from '../../services/adminAuthService';
import {
  isMicrosoftSSOConfigured,
  getMicrosoftLoginUrl,
  handleMicrosoftCallback,
  getMicrosoftSSOStatus,
} from '../../services/microsoftAuthService';

const router = Router();

// =============================================================================
// MICROSOFT SSO ROUTES
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
      magicLink: {
        enabled: true, // Always available as fallback
      },
    },
  });
});

/**
 * GET /api/admin/auth/microsoft
 * Initiate Microsoft SSO login
 */
router.get('/microsoft', async (req: Request, res: Response) => {
  try {
    if (!isMicrosoftSSOConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Microsoft SSO is not configured',
      });
    }

    const { url, state } = await getMicrosoftLoginUrl();

    // Store state in cookie for verification (optional, state param should suffice)
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
 */
router.get('/microsoft/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('Microsoft OAuth error:', error, error_description);
      const adminBaseUrl = process.env.ADMIN_BASE_URL || 'http://localhost:3000';
      return res.redirect(`${adminBaseUrl}/login?error=${error}&message=${encodeURIComponent(String(error_description || ''))}`);
    }

    if (!code || !state) {
      const adminBaseUrl = process.env.ADMIN_BASE_URL || 'http://localhost:3000';
      return res.redirect(`${adminBaseUrl}/login?error=missing_params`);
    }

    const result = await handleMicrosoftCallback(String(code), String(state));

    // Clear state cookie
    res.clearCookie('msal_state');

    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }

    // Fallback if no redirect URL
    const adminBaseUrl = process.env.ADMIN_BASE_URL || 'http://localhost:3000';
    if (result.success && result.jwt) {
      return res.redirect(`${adminBaseUrl}/auth/callback?token=${result.jwt}`);
    }

    return res.redirect(`${adminBaseUrl}/login?error=auth_failed`);
  } catch (error) {
    console.error('Microsoft callback error:', error);
    const adminBaseUrl = process.env.ADMIN_BASE_URL || 'http://localhost:3000';
    return res.redirect(`${adminBaseUrl}/login?error=callback_failed`);
  }
});

// =============================================================================
// MAGIC LINK ROUTES (Fallback/Development)
// =============================================================================

/**
 * POST /api/admin/auth/magic-link
 * Request a magic link for email
 */
router.post('/magic-link', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const result = await requestMagicLink(email);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    // In development, return the magic link URL for testing
    if (process.env.NODE_ENV !== 'production' && result.magicLinkUrl) {
      return res.json({
        success: true,
        message: result.message,
        magicLinkUrl: result.magicLinkUrl, // Only in dev!
      });
    }

    return res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Magic link request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send magic link',
    });
  }
});

/**
 * POST /api/admin/auth/verify
 * Verify magic link token and return JWT
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        error: 'Token and email are required',
      });
    }

    const result = await verifyMagicLink(token, email);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.message,
      });
    }

    return res.json({
      success: true,
      data: {
        token: result.jwt,
        user: result.user,
      },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify token',
    });
  }
});

/**
 * GET /api/admin/auth/me
 * Get current authenticated user
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await getCurrentUser(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
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
 * POST /api/admin/auth/dev-login (Development only)
 * Quick login for development/testing - bypasses email verification
 */
router.post('/dev-login', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { email = 'admin@test.com' } = req.body;

    // Request magic link to auto-create user if needed
    const linkResult = await requestMagicLink(email);
    if (!linkResult.success) {
      return res.status(400).json({
        success: false,
        error: linkResult.message,
      });
    }

    // Extract token from magic link URL
    if (!linkResult.magicLinkUrl) {
      return res.status(400).json({
        success: false,
        error: 'Magic link URL not available',
      });
    }

    const urlParams = new URL(linkResult.magicLinkUrl).searchParams;
    const token = urlParams.get('token');

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract token',
      });
    }

    // Immediately verify it
    const verifyResult = await verifyMagicLink(token, email);
    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        error: verifyResult.message,
      });
    }

    return res.json({
      success: true,
      data: {
        token: verifyResult.jwt,
        user: verifyResult.user,
      },
    });
  } catch (error) {
    console.error('Dev login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Dev login failed',
    });
  }
});

export default router;
