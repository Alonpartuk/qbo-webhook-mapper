/**
 * API Key Management Routes
 *
 * Admin endpoints for managing API keys at organization and global levels.
 *
 * Endpoints:
 * - GET    /api/admin/organizations/:orgId/api-keys     - List org's API keys
 * - POST   /api/admin/organizations/:orgId/api-keys     - Create new API key
 * - POST   /api/admin/organizations/:orgId/api-keys/:keyId/rotate - Rotate key
 * - DELETE /api/admin/organizations/:orgId/api-keys/:keyId - Revoke key
 * - GET    /api/admin/global/api-keys                   - List global admin keys (super_admin only)
 * - POST   /api/admin/global/api-keys                   - Create global admin key (super_admin only)
 */

import { Router, Request, Response } from 'express';
import {
  generateApiKey,
  revokeApiKey,
  rotateApiKey,
  listApiKeys,
} from '../../services/apiKeyService';
import {
  getOrganizationById,
  getGlobalApiKeys,
  getApiKeyById,
} from '../../services/dataService';

const router = Router();

/**
 * GET /api/admin/organizations/:orgId/api-keys
 *
 * List all API keys for an organization.
 * Shows key_id, name, prefix, type, status, last_used_at.
 * Never returns the full key (only visible on creation).
 */
router.get('/organizations/:orgId/api-keys', async (req: Request, res: Response) => {
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

    const keys = await listApiKeys(orgId);

    return res.json({
      success: true,
      data: keys,
    });
  } catch (error) {
    console.error('[ApiKeys] Error listing keys:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list API keys',
    });
  }
});

/**
 * POST /api/admin/organizations/:orgId/api-keys
 *
 * Create a new API key for an organization.
 * Returns the full key ONCE - it cannot be retrieved again.
 *
 * Body:
 * - name: string (required) - Display name for the key
 * - permissions: object (optional) - Custom permissions
 * - expires_at: string (optional) - Expiration date (ISO string)
 */
router.post('/organizations/:orgId/api-keys', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { name, permissions, expires_at } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      });
    }

    // Verify organization exists
    const org = await getOrganizationById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    // Get admin user from request (set by adminAuth middleware)
    const adminUser = (req as { adminUser?: { email: string } }).adminUser;

    const result = await generateApiKey({
      organization_id: orgId,
      name: name.trim(),
      key_type: 'tenant',
      permissions: permissions || {
        endpoints: ['proxy:read', 'proxy:write', 'webhooks:*'],
        rate_limit_tier: 'standard',
      },
      created_by: adminUser?.email || 'admin',
      expires_at: expires_at ? new Date(expires_at) : undefined,
    });

    // Return full key only on creation
    return res.status(201).json({
      success: true,
      data: {
        key_id: result.key_id,
        key: result.key, // Full key - shown only once!
        key_prefix: result.key_prefix,
        name: result.name,
        key_type: result.key_type,
        organization_id: result.organization_id,
        created_at: result.created_at,
        expires_at: result.expires_at,
      },
      message: 'API key created successfully. Save this key now - it cannot be retrieved again.',
    });
  } catch (error) {
    console.error('[ApiKeys] Error creating key:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create API key',
    });
  }
});

/**
 * GET /api/admin/organizations/:orgId/api-keys/:keyId
 *
 * Get details about a specific API key.
 * Does NOT return the full key.
 */
router.get('/organizations/:orgId/api-keys/:keyId', async (req: Request, res: Response) => {
  try {
    const { orgId, keyId } = req.params;

    const key = await getApiKeyById(keyId);

    if (!key) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    // Verify key belongs to this organization
    if (key.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'API key does not belong to this organization',
      });
    }

    // Return key without the hash
    return res.json({
      success: true,
      data: {
        key_id: key.key_id,
        organization_id: key.organization_id,
        key_prefix: key.key_prefix,
        name: key.name,
        key_type: key.key_type,
        permissions: key.permissions,
        is_active: key.is_active,
        created_at: key.created_at,
        created_by: key.created_by,
        last_used_at: key.last_used_at,
        expires_at: key.expires_at,
        revoked_at: key.revoked_at,
        revoked_by: key.revoked_by,
        grace_period_ends_at: key.grace_period_ends_at,
      },
    });
  } catch (error) {
    console.error('[ApiKeys] Error getting key details:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get API key details',
    });
  }
});

/**
 * POST /api/admin/organizations/:orgId/api-keys/:keyId/rotate
 *
 * Rotate an API key - generates a new key while optionally
 * keeping the old one valid for a grace period.
 *
 * Body:
 * - grace_period_hours: number (optional) - Hours to keep old key valid (default: 24)
 */
router.post('/organizations/:orgId/api-keys/:keyId/rotate', async (req: Request, res: Response) => {
  try {
    const { orgId, keyId } = req.params;
    const { grace_period_hours = 24 } = req.body;

    // Verify key exists and belongs to org
    const existingKey = await getApiKeyById(keyId);
    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    if (existingKey.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'API key does not belong to this organization',
      });
    }

    const adminUser = (req as { adminUser?: { email: string } }).adminUser;

    // Convert hours to minutes for the service function
    const gracePeriodMinutes = grace_period_hours * 60;

    const result = await rotateApiKey(keyId, gracePeriodMinutes, adminUser?.email || 'admin');

    // Calculate grace period end time
    const gracePeriodEndsAt = gracePeriodMinutes > 0
      ? new Date(Date.now() + gracePeriodMinutes * 60 * 1000)
      : null;

    return res.json({
      success: true,
      data: {
        new_key_id: result.key_id,
        new_key: result.key, // Full new key - shown only once!
        new_key_prefix: result.key_prefix,
        old_key_id: keyId,
        grace_period_ends_at: gracePeriodEndsAt,
      },
      message: `API key rotated. New key is active. Old key valid until ${gracePeriodEndsAt?.toISOString() || 'immediate revocation'}.`,
    });
  } catch (error) {
    console.error('[ApiKeys] Error rotating key:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to rotate API key',
    });
  }
});

/**
 * DELETE /api/admin/organizations/:orgId/api-keys/:keyId
 *
 * Revoke an API key immediately.
 * The key will no longer authenticate any requests.
 */
router.delete('/organizations/:orgId/api-keys/:keyId', async (req: Request, res: Response) => {
  try {
    const { orgId, keyId } = req.params;

    // Verify key exists and belongs to org
    const existingKey = await getApiKeyById(keyId);
    if (!existingKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    if (existingKey.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'API key does not belong to this organization',
      });
    }

    const adminUser = (req as { adminUser?: { email: string } }).adminUser;

    await revokeApiKey(keyId, adminUser?.email || 'admin');

    return res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('[ApiKeys] Error revoking key:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke API key',
    });
  }
});

// =============================================================================
// GLOBAL ADMIN KEYS (Super Admin Only)
// =============================================================================

/**
 * GET /api/admin/global/api-keys
 *
 * List all global admin API keys.
 * Only accessible by super_admin users.
 */
router.get('/global/api-keys', async (req: Request, res: Response) => {
  try {
    const adminUser = (req as { adminUser?: { role: string } }).adminUser;

    // Check super_admin role
    if (adminUser?.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Requires super_admin role',
      });
    }

    const keys = await getGlobalApiKeys();

    return res.json({
      success: true,
      data: keys,
    });
  } catch (error) {
    console.error('[ApiKeys] Error listing global keys:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list global API keys',
    });
  }
});

/**
 * POST /api/admin/global/api-keys
 *
 * Create a new global admin API key.
 * Only accessible by super_admin users.
 *
 * Body:
 * - name: string (required) - Display name for the key
 * - permissions: object (optional) - Custom permissions
 */
router.post('/global/api-keys', async (req: Request, res: Response) => {
  try {
    const adminUser = (req as { adminUser?: { email: string; role: string } }).adminUser;

    // Check super_admin role
    if (adminUser?.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Requires super_admin role',
      });
    }

    const { name, permissions } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      });
    }

    const result = await generateApiKey({
      organization_id: undefined, // Global key - no org
      name: name.trim(),
      key_type: 'global_admin',
      permissions: permissions || {
        endpoints: ['*'],
        rate_limit_tier: 'unlimited',
      },
      created_by: adminUser?.email || 'super_admin',
    });

    return res.status(201).json({
      success: true,
      data: {
        key_id: result.key_id,
        key: result.key, // Full key - shown only once!
        key_prefix: result.key_prefix,
        name: result.name,
        key_type: result.key_type,
        created_at: result.created_at,
      },
      message: 'Global API key created. Save this key now - it cannot be retrieved again.',
    });
  } catch (error) {
    console.error('[ApiKeys] Error creating global key:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create global API key',
    });
  }
});

export default router;
