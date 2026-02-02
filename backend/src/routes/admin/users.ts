/**
 * Admin User Management Routes
 *
 * CRUD operations for managing admin users.
 * Requires super_admin role for most operations.
 */

import { Router, Request, Response } from 'express';
import { requireSuperAdmin } from '../../middleware/adminAuth';
import * as userService from '../../services/userManagementService';

const router = Router();

/**
 * GET /api/admin/users
 * List all admin users (requires super_admin)
 */
router.get('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await userService.listUsers();
    return res.json(result);
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list users',
    });
  }
});

/**
 * GET /api/admin/users/:userId
 * Get a single user by ID (requires super_admin)
 */
router.get('/:userId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await userService.getUserById(userId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
});

/**
 * POST /api/admin/users
 * Create a new admin user (requires super_admin)
 */
router.post('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { email, name, role } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const result = await userService.createUser(
      req.admin!.user_id,
      req.admin!.email,
      { email, name, role },
      {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }
    );

    if (!result.success) {
      const statusCode = result.error_code === 'DUPLICATE_EMAIL' ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create user',
    });
  }
});

/**
 * PUT /api/admin/users/:userId
 * Update an existing user (requires super_admin)
 */
router.put('/:userId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { name, role } = req.body;

    const result = await userService.updateUser(
      req.admin!.user_id,
      req.admin!.email,
      userId,
      { name, role },
      {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }
    );

    if (!result.success) {
      const statusCode = result.error_code === 'USER_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user',
    });
  }
});

/**
 * POST /api/admin/users/:userId/deactivate
 * Deactivate a user (requires super_admin)
 */
router.post('/:userId/deactivate', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await userService.deactivateUser(
      req.admin!.user_id,
      req.admin!.email,
      userId,
      {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }
    );

    if (!result.success) {
      const statusCode =
        result.error_code === 'USER_NOT_FOUND' ? 404 :
        result.error_code === 'SELF_DEACTIVATION' ? 400 :
        result.error_code === 'LAST_SUPER_ADMIN' ? 400 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Deactivate user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to deactivate user',
    });
  }
});

/**
 * POST /api/admin/users/:userId/reactivate
 * Reactivate a deactivated user (requires super_admin)
 */
router.post('/:userId/reactivate', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await userService.reactivateUser(
      req.admin!.user_id,
      req.admin!.email,
      userId,
      {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }
    );

    if (!result.success) {
      const statusCode = result.error_code === 'USER_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Reactivate user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reactivate user',
    });
  }
});

/**
 * POST /api/admin/users/:userId/reset-password
 * Reset user password to default (requires super_admin)
 */
router.post('/:userId/reset-password', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await userService.resetPassword(
      req.admin!.user_id,
      req.admin!.email,
      userId,
      {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }
    );

    if (!result.success) {
      const statusCode = result.error_code === 'USER_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
});

export default router;
