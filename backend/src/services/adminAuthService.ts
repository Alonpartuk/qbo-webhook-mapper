/**
 * Admin Auth Service
 *
 * Handles JWT authentication for admin dashboard users.
 * Microsoft SSO is the only authentication method.
 */

import jwt from 'jsonwebtoken';
import {
  getAdminUserByEmail,
  getAdminUserById,
} from './dataService';
import { AdminUser } from '../types';

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'admin-jwt-secret-change-in-production';
const JWT_EXPIRATION_DEFAULT = '12h'; // Standard session
const JWT_EXPIRATION_REMEMBER = '30d'; // Remember me session

/**
 * Generate JWT with configurable expiration
 */
export function generateJwt(
  userId: string,
  email: string,
  role: string,
  rememberMe: boolean = false
): string {
  return jwt.sign(
    {
      userId,
      email,
      role,
      rememberMe,
    },
    JWT_SECRET,
    { expiresIn: rememberMe ? JWT_EXPIRATION_REMEMBER : JWT_EXPIRATION_DEFAULT }
  );
}

/**
 * Verify a JWT token
 */
export function verifyJwt(token: string): {
  valid: boolean;
  payload?: { userId: string; email: string; role: string; rememberMe?: boolean };
} {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
      rememberMe?: boolean;
    };
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

/**
 * Get current admin user from JWT
 */
export async function getCurrentUser(token: string): Promise<AdminUser | null> {
  const { valid, payload } = verifyJwt(token);
  if (!valid || !payload) {
    return null;
  }

  const user = await getAdminUserById(payload.userId);
  return user;
}

/**
 * Refresh JWT with same expiration type
 */
export function refreshJwt(token: string): {
  success: boolean;
  jwt?: string;
  rememberMe?: boolean;
} {
  const { valid, payload } = verifyJwt(token);
  if (!valid || !payload) {
    return { success: false };
  }

  const rememberMe = payload.rememberMe || false;

  // Generate new token with same expiration type
  const newToken = jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      rememberMe,
    },
    JWT_SECRET,
    { expiresIn: rememberMe ? JWT_EXPIRATION_REMEMBER : JWT_EXPIRATION_DEFAULT }
  );

  return { success: true, jwt: newToken, rememberMe };
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: AdminUser): boolean {
  return user.role === 'admin' || user.role === 'super_admin';
}

/**
 * Check if user has super admin role
 */
export function isSuperAdmin(user: AdminUser): boolean {
  return user.role === 'super_admin';
}
