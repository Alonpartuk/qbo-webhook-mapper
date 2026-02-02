/**
 * User Management Service
 *
 * Handles admin user CRUD operations with:
 * - @octup.com email domain restriction (ONLY allowed domain)
 * - Protection against self-deactivation
 * - Protection of last super_admin
 * - Audit logging integration
 */

import bcrypt from 'bcrypt';
import { AdminUser, AdminRole } from '../types';
import * as dataService from './dataService';
import * as auditLog from './auditLogService';

const BCRYPT_ROUNDS = 10;
const ALLOWED_EMAIL_DOMAIN = 'octup.com';
const DEFAULT_PASSWORD = 'Octup@2026!';

// Response types
export interface UserManagementResult {
  success: boolean;
  message: string;
  user?: AdminUser;
  error_code?: string;
}

export interface UserListResult {
  success: boolean;
  users: AdminUser[];
  total: number;
}

/**
 * Validate email domain - ONLY @octup.com is allowed
 */
function validateEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === ALLOWED_EMAIL_DOMAIN;
}

/**
 * Sanitize user object for API response (remove sensitive fields)
 */
function sanitizeUser(user: AdminUser): Omit<AdminUser, 'password_hash'> {
  const { password_hash, ...sanitized } = user;
  return sanitized;
}

/**
 * Get all admin users (for listing)
 */
export async function listUsers(): Promise<UserListResult> {
  const users = await dataService.getAllAdminUsers();
  return {
    success: true,
    users: users.map(sanitizeUser) as AdminUser[],
    total: users.length,
  };
}

/**
 * Get a single user by ID
 */
export async function getUserById(userId: string): Promise<UserManagementResult> {
  const user = await dataService.getAdminUserById(userId);

  if (!user) {
    return {
      success: false,
      message: 'User not found',
      error_code: 'USER_NOT_FOUND',
    };
  }

  return {
    success: true,
    message: 'User found',
    user: sanitizeUser(user) as AdminUser,
  };
}

/**
 * Create a new admin user
 */
export async function createUser(
  actorId: string,
  actorEmail: string,
  input: {
    email: string;
    name?: string;
    role?: AdminRole;
  },
  requestContext?: {
    ip?: string;
    userAgent?: string;
  }
): Promise<UserManagementResult> {
  const email = input.email.toLowerCase().trim();

  // Validate email domain - ONLY @octup.com allowed
  if (!validateEmailDomain(email)) {
    auditLog.logUserMgmt('user_created', 'failure', {
      actorId,
      actorEmail,
      targetUserId: '',
      targetEmail: email,
      ip: requestContext?.ip,
      userAgent: requestContext?.userAgent,
      errorMessage: 'Email domain not allowed',
      details: { attempted_email: email },
    });

    return {
      success: false,
      message: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses are allowed`,
      error_code: 'INVALID_DOMAIN',
    };
  }

  // Check for duplicate email
  const existingUser = await dataService.getAdminUserByEmail(email);
  if (existingUser) {
    auditLog.logUserMgmt('user_created', 'failure', {
      actorId,
      actorEmail,
      targetUserId: existingUser.user_id,
      targetEmail: email,
      ip: requestContext?.ip,
      userAgent: requestContext?.userAgent,
      errorMessage: 'Email already exists',
    });

    return {
      success: false,
      message: 'A user with this email already exists',
      error_code: 'DUPLICATE_EMAIL',
    };
  }

  // Hash default password
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // Create user
  const user = await dataService.createAdminUser(
    email,
    input.name || undefined,
    input.role || 'admin',
    passwordHash,
    true // must_change_password
  );

  // Log success
  auditLog.logUserMgmt('user_created', 'success', {
    actorId,
    actorEmail,
    targetUserId: user.user_id,
    targetEmail: email,
    ip: requestContext?.ip,
    userAgent: requestContext?.userAgent,
    details: {
      role: user.role,
      name: user.name,
    },
  });

  return {
    success: true,
    message: `User created successfully. Default password: ${DEFAULT_PASSWORD}`,
    user: sanitizeUser(user) as AdminUser,
  };
}

/**
 * Update an existing user
 */
export async function updateUser(
  actorId: string,
  actorEmail: string,
  targetUserId: string,
  updates: {
    name?: string;
    role?: AdminRole;
  },
  requestContext?: {
    ip?: string;
    userAgent?: string;
  }
): Promise<UserManagementResult> {
  // Get target user
  const targetUser = await dataService.getAdminUserById(targetUserId);

  if (!targetUser) {
    return {
      success: false,
      message: 'User not found',
      error_code: 'USER_NOT_FOUND',
    };
  }

  // If downgrading from super_admin, check protection
  if (targetUser.role === 'super_admin' && updates.role === 'admin') {
    const superAdminCount = await dataService.countSuperAdmins();
    if (superAdminCount <= 1) {
      auditLog.logUserMgmt('user_updated', 'failure', {
        actorId,
        actorEmail,
        targetUserId,
        targetEmail: targetUser.email,
        ip: requestContext?.ip,
        userAgent: requestContext?.userAgent,
        errorMessage: 'Cannot demote last super admin',
      });

      return {
        success: false,
        message: 'Cannot demote the last super admin',
        error_code: 'LAST_SUPER_ADMIN',
      };
    }
  }

  // Apply updates
  await dataService.updateAdminUser(targetUserId, updates);

  // Get updated user
  const updatedUser = await dataService.getAdminUserById(targetUserId);

  // Log success
  auditLog.logUserMgmt('user_updated', 'success', {
    actorId,
    actorEmail,
    targetUserId,
    targetEmail: targetUser.email,
    ip: requestContext?.ip,
    userAgent: requestContext?.userAgent,
    details: {
      changes: updates,
      previous_role: targetUser.role,
      previous_name: targetUser.name,
    },
  });

  return {
    success: true,
    message: 'User updated successfully',
    user: sanitizeUser(updatedUser!) as AdminUser,
  };
}

/**
 * Deactivate a user (soft delete)
 */
export async function deactivateUser(
  actorId: string,
  actorEmail: string,
  targetUserId: string,
  requestContext?: {
    ip?: string;
    userAgent?: string;
  }
): Promise<UserManagementResult> {
  // Cannot deactivate self
  if (actorId === targetUserId) {
    auditLog.logUserMgmt('user_deactivated', 'failure', {
      actorId,
      actorEmail,
      targetUserId,
      ip: requestContext?.ip,
      userAgent: requestContext?.userAgent,
      errorMessage: 'Cannot deactivate yourself',
    });

    return {
      success: false,
      message: 'You cannot deactivate your own account',
      error_code: 'SELF_DEACTIVATION',
    };
  }

  // Get target user
  const targetUser = await dataService.getAdminUserById(targetUserId);

  if (!targetUser) {
    return {
      success: false,
      message: 'User not found',
      error_code: 'USER_NOT_FOUND',
    };
  }

  // Cannot deactivate last super admin
  if (targetUser.role === 'super_admin') {
    const superAdminCount = await dataService.countSuperAdmins();
    if (superAdminCount <= 1) {
      auditLog.logUserMgmt('user_deactivated', 'failure', {
        actorId,
        actorEmail,
        targetUserId,
        targetEmail: targetUser.email,
        ip: requestContext?.ip,
        userAgent: requestContext?.userAgent,
        errorMessage: 'Cannot deactivate last super admin',
      });

      return {
        success: false,
        message: 'Cannot deactivate the last super admin',
        error_code: 'LAST_SUPER_ADMIN',
      };
    }
  }

  // Deactivate
  await dataService.updateAdminUser(targetUserId, { is_active: false });

  // Log success
  auditLog.logUserMgmt('user_deactivated', 'success', {
    actorId,
    actorEmail,
    targetUserId,
    targetEmail: targetUser.email,
    ip: requestContext?.ip,
    userAgent: requestContext?.userAgent,
  });

  return {
    success: true,
    message: 'User deactivated successfully',
  };
}

/**
 * Reactivate a deactivated user
 */
export async function reactivateUser(
  actorId: string,
  actorEmail: string,
  targetUserId: string,
  requestContext?: {
    ip?: string;
    userAgent?: string;
  }
): Promise<UserManagementResult> {
  // Get target user
  const targetUser = await dataService.getAdminUserById(targetUserId);

  if (!targetUser) {
    return {
      success: false,
      message: 'User not found',
      error_code: 'USER_NOT_FOUND',
    };
  }

  if (targetUser.is_active) {
    return {
      success: false,
      message: 'User is already active',
      error_code: 'ALREADY_ACTIVE',
    };
  }

  // Reactivate
  await dataService.updateAdminUser(targetUserId, { is_active: true });

  // Log success
  auditLog.logUserMgmt('user_reactivated', 'success', {
    actorId,
    actorEmail,
    targetUserId,
    targetEmail: targetUser.email,
    ip: requestContext?.ip,
    userAgent: requestContext?.userAgent,
  });

  return {
    success: true,
    message: 'User reactivated successfully',
  };
}

/**
 * Reset user password to default
 */
export async function resetPassword(
  actorId: string,
  actorEmail: string,
  targetUserId: string,
  requestContext?: {
    ip?: string;
    userAgent?: string;
  }
): Promise<UserManagementResult> {
  // Get target user
  const targetUser = await dataService.getAdminUserById(targetUserId);

  if (!targetUser) {
    return {
      success: false,
      message: 'User not found',
      error_code: 'USER_NOT_FOUND',
    };
  }

  // Hash default password
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // Update password
  await dataService.updateAdminUser(targetUserId, {
    password_hash: passwordHash,
    must_change_password: true,
  });

  // Log success
  auditLog.log({
    category: 'auth',
    action: 'password_reset',
    result: 'success',
    actor_type: 'admin_user',
    actor_id: actorId,
    actor_email: actorEmail,
    actor_ip: requestContext?.ip,
    user_agent: requestContext?.userAgent,
    target_type: 'user',
    target_id: targetUserId,
    details: {
      target_email: targetUser.email,
      reset_by: 'admin',
    },
  });

  return {
    success: true,
    message: `Password reset successfully. New password: ${DEFAULT_PASSWORD}`,
  };
}
