/**
 * Admin Routes Index
 *
 * Combines all admin routes under /api/admin
 * All routes except /auth require admin authentication
 */

import { Router } from 'express';
import authRouter from './auth';
import organizationsRouter from './organizations';
import templatesRouter from './templates';
import overridesRouter from './overrides';
import { adminAuth } from '../../middleware/adminAuth';

const router = Router();

// Auth routes (no auth required - handles login/logout)
router.use('/auth', authRouter);

// Organization routes (requires admin authentication)
router.use('/organizations', adminAuth, organizationsRouter);

// Global template routes (requires admin authentication)
router.use('/templates', adminAuth, templatesRouter);

// Client override routes (includes effective-mapping, payloads, logs)
// These are mounted at root because some paths start with /organizations/:orgId
router.use('/', adminAuth, overridesRouter);

export default router;
