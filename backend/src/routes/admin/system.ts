/**
 * System Monitoring Routes
 *
 * Admin endpoints for global system monitoring and health checks.
 *
 * Endpoints:
 * - GET /api/admin/system/connections    - All tenant connections status
 * - GET /api/admin/system/health         - System health summary
 * - GET /api/admin/system/alerts/tokens  - Token expiry alerts
 * - GET /api/admin/system/alerts/failures - Recent sync failures
 */

import { Router, Request, Response } from 'express';
import {
  getAllTenantConnections,
  getSystemHealthSummary,
  getExpiringTokenAlerts,
  getRecentSyncFailures,
  getQuickHealthCheck,
} from '../../services/systemMonitoringService';

const router = Router();

/**
 * GET /api/admin/system/connections
 *
 * Get connection status for all tenants.
 * Shows organizations with their QBO connection status, realm_id,
 * last sync date, and 24h sync statistics.
 */
router.get('/connections', async (req: Request, res: Response) => {
  try {
    const connections = await getAllTenantConnections();

    return res.json({
      success: true,
      data: connections,
      meta: {
        total: connections.length,
        connected: connections.filter(c => c.qbo_connected).length,
        disconnected: connections.filter(c => !c.qbo_connected && c.is_active).length,
      },
    });
  } catch (error) {
    console.error('[SystemRoutes] Error fetching connections:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tenant connections',
    });
  }
});

/**
 * GET /api/admin/system/health
 *
 * Get overall system health summary.
 * Includes organization counts, sync statistics, and alerts.
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthCheck = await getQuickHealthCheck();

    return res.json({
      success: true,
      data: {
        status: healthCheck.healthy ? 'healthy' : 'warning',
        issues: healthCheck.issues,
        summary: healthCheck.summary,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[SystemRoutes] Error fetching health:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch system health',
    });
  }
});

/**
 * GET /api/admin/system/alerts/tokens
 *
 * Get tokens that are expiring soon.
 *
 * Query Parameters:
 * - hours: Number of hours to look ahead (default: 24)
 */
router.get('/alerts/tokens', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const alerts = await getExpiringTokenAlerts(hours);

    return res.json({
      success: true,
      data: alerts,
      meta: {
        total: alerts.length,
        within_hours: hours,
      },
    });
  } catch (error) {
    console.error('[SystemRoutes] Error fetching token alerts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch token expiry alerts',
    });
  }
});

/**
 * GET /api/admin/system/alerts/failures
 *
 * Get recent sync failures across all organizations.
 *
 * Query Parameters:
 * - limit: Maximum number of failures to return (default: 20)
 */
router.get('/alerts/failures', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const failures = await getRecentSyncFailures(limit);

    return res.json({
      success: true,
      data: failures,
      meta: {
        total: failures.length,
        limit,
      },
    });
  } catch (error) {
    console.error('[SystemRoutes] Error fetching failures:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sync failures',
    });
  }
});

/**
 * GET /api/admin/system/summary
 *
 * Get a condensed system summary for dashboard widgets.
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await getSystemHealthSummary();

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[SystemRoutes] Error fetching summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch system summary',
    });
  }
});

export default router;
