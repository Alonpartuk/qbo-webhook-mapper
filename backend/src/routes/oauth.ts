/**
 * Legacy OAuth Routes (DEPRECATED)
 *
 * These routes are deprecated and disabled. Use the multi-tenant V1 API instead:
 * - GET /api/v1/connect/:clientSlug - Start OAuth flow for an organization
 * - GET /api/v1/oauth/callback - OAuth callback (shared)
 * - GET /api/v1/org/:clientSlug/status - Get connection status
 * - POST /api/v1/org/:clientSlug/disconnect - Disconnect from QBO
 */

import { Router, Request, Response } from 'express';

const router = Router();

const DEPRECATION_MESSAGE = {
  success: false,
  error: 'This endpoint is deprecated. Please use the multi-tenant V1 API: /api/v1/connect/:clientSlug',
  docs: 'See /api/v1/org/:clientSlug/status for connection status',
};

// All legacy OAuth routes return deprecation error
router.get('/qbo/authorize', (_req: Request, res: Response) => {
  return res.status(410).json(DEPRECATION_MESSAGE);
});

router.get('/qbo/callback', (_req: Request, res: Response) => {
  return res.status(410).json({
    ...DEPRECATION_MESSAGE,
    error: 'Legacy OAuth callback is disabled. OAuth callbacks should use /api/v1/oauth/callback',
  });
});

router.get('/qbo/status', (_req: Request, res: Response) => {
  return res.status(410).json({
    ...DEPRECATION_MESSAGE,
    error: 'Use /api/v1/org/:clientSlug/status for per-organization connection status',
  });
});

router.post('/qbo/disconnect', (_req: Request, res: Response) => {
  return res.status(410).json({
    ...DEPRECATION_MESSAGE,
    error: 'Use POST /api/v1/org/:clientSlug/disconnect for per-organization disconnect',
  });
});

router.post('/qbo/refresh', (_req: Request, res: Response) => {
  return res.status(410).json({
    ...DEPRECATION_MESSAGE,
    error: 'Token refresh is handled automatically per-organization',
  });
});

export default router;
