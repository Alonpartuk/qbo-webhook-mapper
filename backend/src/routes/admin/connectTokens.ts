/**
 * Admin Connect Token Routes
 *
 * Manage masked connect URLs for organizations.
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/adminAuth';
import { AdminContext } from '../../types';
import {
  createToken,
  getTokens,
  revokeToken,
  buildConnectUrl,
} from '../../services/connectTokenService';
import { getOrganizationById } from '../../services/dataService';

const router = Router();

/**
 * GET /api/admin/organizations/:orgId/connect-tokens
 *
 * Get all connect tokens for an organization
 */
router.get('/organizations/:orgId/connect-tokens', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // Verify organization exists
    const org = await getOrganizationById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    const tokens = await getTokens(orgId);

    // Build full URLs for each token
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const tokensWithUrls = tokens.map(token => ({
      ...token,
      connect_url: buildConnectUrl(token.token_hash, baseUrl),
    }));

    return res.json({
      success: true,
      data: tokensWithUrls,
    });
  } catch (error) {
    console.error('Get connect tokens error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get connect tokens',
    });
  }
});

/**
 * POST /api/admin/organizations/:orgId/connect-tokens
 *
 * Create a new connect token for an organization
 */
router.post('/organizations/:orgId/connect-tokens', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { name, expires_in_hours, max_uses } = req.body;

    // Calculate expiration date if specified
    let expires_at: Date | undefined;
    if (expires_in_hours && typeof expires_in_hours === 'number') {
      expires_at = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);
    }

    // Extract admin user from request (added by adminAuth middleware)
    const admin = (req as Request & { admin?: AdminContext }).admin;

    const result = await createToken(orgId, {
      name,
      expires_at,
      max_uses,
      created_by: admin?.user_id,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    // Build full URL
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const connectUrl = buildConnectUrl(result.token!.token_hash, baseUrl);

    return res.json({
      success: true,
      data: {
        ...result.token,
        connect_url: connectUrl,
      },
    });
  } catch (error) {
    console.error('Create connect token error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create connect token',
    });
  }
});

/**
 * DELETE /api/admin/organizations/:orgId/connect-tokens/:tokenId
 *
 * Revoke a connect token
 */
router.delete('/organizations/:orgId/connect-tokens/:tokenId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;

    const result = await revokeToken(tokenId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      message: 'Connect token revoked',
    });
  } catch (error) {
    console.error('Revoke connect token error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke connect token',
    });
  }
});

export default router;
