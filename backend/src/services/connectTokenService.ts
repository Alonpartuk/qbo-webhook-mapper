/**
 * Connect Token Service
 *
 * Manages secure, masked URLs for external QBO connection.
 * Replaces organization slugs with unique hashes to prevent URL guessing.
 */

import crypto from 'crypto';
import {
  createConnectToken,
  getConnectTokenByHash,
  getConnectTokensByOrganization,
  incrementConnectTokenUsage,
  deactivateConnectToken,
  getOrganizationById,
} from './dataService';
import { ConnectToken, Organization } from '../types';

/**
 * Generate a secure random hash for connect URLs
 * Format: 12 alphanumeric characters (lowercase + digits)
 */
function generateTokenHash(): string {
  const bytes = crypto.randomBytes(9); // 9 bytes = 72 bits
  return bytes.toString('base64url').replace(/[_-]/g, '').slice(0, 12).toLowerCase();
}

/**
 * Create a new connect token for an organization
 */
export async function createToken(
  organizationId: string,
  options: {
    name?: string;
    expires_at?: Date;
    max_uses?: number;
    created_by?: string;
  } = {}
): Promise<{ success: boolean; token?: ConnectToken; error?: string }> {
  try {
    // Verify organization exists
    const org = await getOrganizationById(organizationId);
    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    // Generate unique hash (with collision check)
    let hash = generateTokenHash();
    let attempts = 0;
    while (await getConnectTokenByHash(hash)) {
      hash = generateTokenHash();
      attempts++;
      if (attempts > 10) {
        return { success: false, error: 'Failed to generate unique token' };
      }
    }

    const token = await createConnectToken(organizationId, hash, options);
    return { success: true, token };
  } catch (error) {
    console.error('[ConnectToken] Create error:', error);
    return { success: false, error: 'Failed to create connect token' };
  }
}

/**
 * Validate a connect token and get the associated organization
 * Returns the organization if valid, null otherwise
 */
export async function validateToken(
  tokenHash: string
): Promise<{ valid: boolean; organization?: Organization; token?: ConnectToken; error?: string }> {
  try {
    const token = await getConnectTokenByHash(tokenHash);

    if (!token) {
      return { valid: false, error: 'Invalid or expired link' };
    }

    // Check if token is expired
    if (token.expires_at && new Date() > token.expires_at) {
      return { valid: false, error: 'This connection link has expired' };
    }

    // Check if max uses exceeded
    if (token.max_uses && token.use_count >= token.max_uses) {
      return { valid: false, error: 'This connection link has reached its usage limit' };
    }

    // Get organization
    const org = await getOrganizationById(token.organization_id);
    if (!org || !org.is_active) {
      return { valid: false, error: 'Organization not found or inactive' };
    }

    return { valid: true, organization: org, token };
  } catch (error) {
    console.error('[ConnectToken] Validate error:', error);
    return { valid: false, error: 'Failed to validate connection link' };
  }
}

/**
 * Mark a token as used (increment usage count)
 */
export async function markTokenUsed(tokenId: string): Promise<void> {
  await incrementConnectTokenUsage(tokenId);
}

/**
 * Get all tokens for an organization
 */
export async function getTokens(organizationId: string): Promise<ConnectToken[]> {
  return getConnectTokensByOrganization(organizationId);
}

/**
 * Revoke a connect token
 */
export async function revokeToken(
  tokenId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deactivateConnectToken(tokenId);
    return { success: true };
  } catch (error) {
    console.error('[ConnectToken] Revoke error:', error);
    return { success: false, error: 'Failed to revoke token' };
  }
}

/**
 * Build the public connect URL for a token
 */
export function buildConnectUrl(tokenHash: string, baseUrl?: string): string {
  const base = baseUrl || process.env.FRONTEND_URL || '';
  return `${base}/connect/${tokenHash}`;
}
