/**
 * Audit Logs Routes
 *
 * Query and view audit logs for the platform.
 * Requires super_admin role.
 */

import { Router, Request, Response } from 'express';
import { requireSuperAdmin } from '../../middleware/adminAuth';
import * as auditLogService from '../../services/auditLogService';
import { AuditCategory, AuditAction, AuditResult } from '../../types/auditLog';

const router = Router();

/**
 * GET /api/admin/audit-logs
 * Query audit logs with filters (requires super_admin)
 *
 * Query params:
 * - start_date: ISO date string
 * - end_date: ISO date string
 * - category: AuditCategory or comma-separated list
 * - action: AuditAction or comma-separated list
 * - result: success | failure | error
 * - actor_type: admin_user | api_key | system | anonymous
 * - actor_id: string
 * - actor_email: string
 * - target_type: string
 * - target_id: string
 * - organization_id: string
 * - limit: number (default 50, max 500)
 * - offset: number (default 0)
 */
router.get('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const {
      start_date,
      end_date,
      category,
      action,
      result,
      actor_type,
      actor_id,
      actor_email,
      target_type,
      target_id,
      organization_id,
      limit = '50',
      offset = '0',
    } = req.query;

    // Parse dates
    const filters: Parameters<typeof auditLogService.queryLogs>[0] = {
      limit: Math.min(parseInt(limit as string, 10) || 50, 500),
      offset: parseInt(offset as string, 10) || 0,
    };

    if (start_date) {
      filters.start_date = new Date(start_date as string);
    }

    if (end_date) {
      filters.end_date = new Date(end_date as string);
    }

    if (category) {
      const categories = (category as string).split(',') as AuditCategory[];
      filters.category = categories.length === 1 ? categories[0] : categories;
    }

    if (action) {
      const actions = (action as string).split(',') as AuditAction[];
      filters.action = actions.length === 1 ? actions[0] : actions;
    }

    if (result) {
      filters.result = result as AuditResult;
    }

    if (actor_type) {
      filters.actor_type = actor_type as 'admin_user' | 'api_key' | 'system' | 'anonymous';
    }

    if (actor_id) {
      filters.actor_id = actor_id as string;
    }

    if (actor_email) {
      filters.actor_email = actor_email as string;
    }

    if (target_type) {
      filters.target_type = target_type as string;
    }

    if (target_id) {
      filters.target_id = target_id as string;
    }

    if (organization_id) {
      filters.organization_id = organization_id as string;
    }

    const response = await auditLogService.queryLogs(filters);

    return res.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error('Query audit logs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to query audit logs',
    });
  }
});

/**
 * GET /api/admin/audit-logs/stats
 * Get audit log statistics (requires super_admin)
 *
 * Query params:
 * - hours: number (default 24)
 */
router.get('/stats', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string, 10) || 24;
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get logs for the time period
    const response = await auditLogService.queryLogs({
      start_date: startDate,
      limit: 10000, // Get all for stats
    });

    // Calculate stats
    const stats = {
      total: response.total,
      by_category: {} as Record<string, number>,
      by_result: {} as Record<string, number>,
      by_action: {} as Record<string, number>,
    };

    for (const log of response.logs) {
      // By category
      stats.by_category[log.category] = (stats.by_category[log.category] || 0) + 1;
      // By result
      stats.by_result[log.result] = (stats.by_result[log.result] || 0) + 1;
      // By action
      stats.by_action[log.action] = (stats.by_action[log.action] || 0) + 1;
    }

    return res.json({
      success: true,
      data: {
        period_hours: hours,
        ...stats,
      },
    });
  } catch (error) {
    console.error('Get audit log stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get audit log statistics',
    });
  }
});

/**
 * GET /api/admin/audit-logs/categories
 * Get available audit log categories and actions
 */
router.get('/categories', requireSuperAdmin, async (_req: Request, res: Response) => {
  const categories = {
    auth: ['login_success', 'login_failed', 'logout', 'password_change', 'password_reset'],
    user_mgmt: ['user_created', 'user_updated', 'user_deactivated', 'user_reactivated', 'user_deleted'],
    api_key: ['api_key_created', 'api_key_used', 'api_key_rotated', 'api_key_revoked', 'api_key_expired'],
    qbo: ['qbo_connect_started', 'qbo_connect_success', 'qbo_connect_failed', 'qbo_disconnect', 'qbo_token_refresh', 'qbo_token_refresh_failed', 'qbo_api_call', 'qbo_api_error'],
    webhook: ['webhook_received', 'webhook_processed', 'webhook_failed', 'webhook_invalid'],
    organization: ['org_created', 'org_updated', 'org_deactivated'],
    mapping: ['mapping_created', 'mapping_updated', 'mapping_deleted', 'template_created', 'template_updated'],
    system: ['system_error', 'rate_limit_exceeded'],
  };

  return res.json({
    success: true,
    data: categories,
  });
});

export default router;
