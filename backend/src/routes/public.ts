/**
 * Public API Routes
 *
 * Unauthenticated endpoints for public-facing features.
 * These endpoints expose ONLY minimal, non-sensitive information.
 */

import { Router, Request, Response } from 'express';
import { getOrganizationBySlug } from '../services/dataService';
import { validateToken } from '../services/connectTokenService';

const router = Router();

/**
 * GET /api/public/org/:slug
 *
 * Get minimal public info about an organization.
 * Used by the public connect page to display organization name/logo.
 * Does NOT expose internal IDs or sensitive data.
 */
router.get('/org/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const org = await getOrganizationBySlug(slug);

    if (!org) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Check if org is active and connection link is enabled
    if (!org.is_active || !org.connection_link_enabled) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Return ONLY public, non-sensitive information
    return res.json({
      success: true,
      data: {
        name: org.name,
        slug: org.slug,
        // logo_url: org.logo_url, // Add when logo support is implemented
      },
    });
  } catch (error) {
    console.error('Public org lookup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch organization',
    });
  }
});

/**
 * GET /api/public/connect/:tokenHash
 *
 * Validate a connect token and get organization info.
 * Used by the public connect page with masked URLs.
 */
router.get('/connect/:tokenHash', async (req: Request, res: Response) => {
  try {
    const { tokenHash } = req.params;

    const result = await validateToken(tokenHash);

    if (!result.valid || !result.organization) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Invalid connection link',
      });
    }

    const org = result.organization;

    // Check if connection link is enabled for this org
    if (!org.connection_link_enabled) {
      return res.status(404).json({
        success: false,
        error: 'Connection link is not available for this organization',
      });
    }

    // Return ONLY public, non-sensitive information
    // Include the token hash so the frontend knows to use token-based OAuth
    return res.json({
      success: true,
      data: {
        name: org.name,
        slug: org.slug,
        token_hash: tokenHash, // Include for OAuth flow
        // logo_url: org.logo_url, // Add when logo support is implemented
      },
    });
  } catch (error) {
    console.error('Public connect token lookup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate connection link',
    });
  }
});

export default router;
