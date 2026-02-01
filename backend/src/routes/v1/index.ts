/**
 * V1 API Routes Index
 *
 * Multi-tenant API routes (v1)
 * All routes are scoped by organization via :clientSlug parameter
 */

import { Router } from 'express';
import webhooksRouter from './webhooks';
import connectRouter from './connect';
import proxyRouter from './proxy';
import { requestLogger } from '../../middleware/requestLogger';

const router = Router();

// Mount v1 route modules with request logging for audit trail
router.use('/webhook', requestLogger, webhooksRouter);
router.use('/org', requestLogger, proxyRouter);  // Proxy API routes (/api/v1/org/:slug/proxy/*)
router.use('/', connectRouter);

export default router;
