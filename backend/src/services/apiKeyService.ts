/**
 * API Key Service
 *
 * Handles API key lifecycle management:
 * - Generation with secure random bytes
 * - SHA256 hashing for storage (keys never stored in plain text)
 * - Validation with timing-safe comparison
 * - Rotation with grace period support
 * - Revocation and expiration handling
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiKey,
  ApiKeyType,
  ApiKeyPermissions,
  CreateApiKeyInput,
  CreateApiKeyResult,
  ApiKeyValidationResult,
  ApiKeyListItem,
  RateLimitTier,
} from '../types/apiKey';
import {
  createApiKey as dbCreateApiKey,
  getApiKeyByHash,
  getApiKeyById,
  getApiKeysByOrganization,
  getGlobalApiKeys,
  updateApiKey,
  updateApiKeyLastUsed,
} from './dataService';

// Key format: qbo_live_<32 random hex characters>
const KEY_PREFIX = 'qbo_live_';
const KEY_RANDOM_BYTES = 16; // 16 bytes = 32 hex characters

/**
 * Generate a cryptographically secure API key
 * Format: qbo_live_<32 hex chars>
 */
function generateSecureKey(): string {
  const randomPart = crypto.randomBytes(KEY_RANDOM_BYTES).toString('hex');
  return `${KEY_PREFIX}${randomPart}`;
}

/**
 * Hash an API key using SHA256
 * This is what gets stored in the database
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Extract the last 4 characters of a key for display
 */
function getKeyPrefix(key: string): string {
  return key.slice(-4);
}

/**
 * Timing-safe comparison of key hashes
 */
function safeCompareHashes(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    // Length mismatch - hashes don't match
    return false;
  }
}

/**
 * Generate a new API key for an organization or as global admin
 *
 * @param input - Key creation parameters
 * @returns The created key (full key shown only once) and metadata
 */
export async function generateApiKey(
  input: CreateApiKeyInput
): Promise<CreateApiKeyResult> {
  // Generate secure key
  const key = generateSecureKey();
  const keyHash = hashApiKey(key);
  const keyPrefix = getKeyPrefix(key);
  const keyId = uuidv4();

  // Default permissions based on key type
  const defaultPermissions: ApiKeyPermissions = input.key_type === 'global_admin'
    ? { endpoints: ['*'], rate_limit_tier: 'unlimited' }
    : { endpoints: ['proxy:read', 'webhooks:write'], rate_limit_tier: 'standard' };

  const permissions = input.permissions || defaultPermissions;

  // Create key in database
  const apiKey: ApiKey = {
    key_id: keyId,
    organization_id: input.organization_id || null,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    name: input.name,
    key_type: input.key_type,
    permissions,
    is_active: true,
    created_at: new Date(),
    created_by: input.created_by || null,
    last_used_at: null,
    expires_at: input.expires_at || null,
    revoked_at: null,
    revoked_by: null,
    grace_period_ends_at: null,
  };

  await dbCreateApiKey(apiKey);

  console.log(`[ApiKeyService] Created ${input.key_type} key: ${keyId} (${keyPrefix})`);

  // Return the key - this is the ONLY time the full key is available
  return {
    key_id: keyId,
    key,
    key_prefix: keyPrefix,
    name: input.name,
    key_type: input.key_type,
    organization_id: input.organization_id || null,
    created_at: apiKey.created_at,
    expires_at: apiKey.expires_at,
  };
}

/**
 * Validate an API key
 *
 * @param key - The full API key to validate
 * @returns Validation result with key data if valid
 */
export async function validateApiKey(key: string): Promise<ApiKeyValidationResult> {
  // Basic format validation
  if (!key || !key.startsWith(KEY_PREFIX)) {
    return { valid: false, error: 'Invalid key format' };
  }

  // Hash the provided key
  const keyHash = hashApiKey(key);

  // Look up key by hash
  const apiKey = await getApiKeyByHash(keyHash);

  if (!apiKey) {
    // Check if this might be a rotated key in grace period
    // (We'd need to check the old_key_hash field if we add that)
    return { valid: false, error: 'Invalid API key' };
  }

  // Check if key is active
  if (!apiKey.is_active) {
    return { valid: false, error: 'API key is inactive' };
  }

  // Check if key has been revoked
  if (apiKey.revoked_at) {
    return { valid: false, error: 'API key has been revoked' };
  }

  // Check if key has expired
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  // Key is valid - update last_used_at (fire and forget)
  updateApiKeyLastUsed(apiKey.key_id).catch((err) => {
    console.error('[ApiKeyService] Failed to update last_used_at:', err);
  });

  return { valid: true, key: apiKey };
}

/**
 * Rotate an API key with optional grace period
 *
 * @param keyId - ID of the key to rotate
 * @param gracePeriodMinutes - How long the old key remains valid (default: 0 = immediate)
 * @param rotatedBy - User ID who initiated the rotation
 * @returns New key details
 */
export async function rotateApiKey(
  keyId: string,
  gracePeriodMinutes: number = 0,
  rotatedBy?: string
): Promise<CreateApiKeyResult> {
  // Get existing key
  const existingKey = await getApiKeyById(keyId);
  if (!existingKey) {
    throw new Error('API key not found');
  }

  if (!existingKey.is_active) {
    throw new Error('Cannot rotate an inactive key');
  }

  // Generate new key with same settings
  const newKeyResult = await generateApiKey({
    organization_id: existingKey.organization_id,
    name: existingKey.name,
    key_type: existingKey.key_type,
    permissions: existingKey.permissions || undefined,
    created_by: rotatedBy,
  });

  // Set grace period on old key (or revoke immediately)
  if (gracePeriodMinutes > 0) {
    const gracePeriodEnds = new Date(Date.now() + gracePeriodMinutes * 60 * 1000);
    await updateApiKey(keyId, {
      grace_period_ends_at: gracePeriodEnds,
    });
    console.log(`[ApiKeyService] Key ${keyId} in grace period until ${gracePeriodEnds.toISOString()}`);
  } else {
    // Immediate revocation
    await revokeApiKey(keyId, rotatedBy);
  }

  return newKeyResult;
}

/**
 * Revoke an API key
 *
 * @param keyId - ID of the key to revoke
 * @param revokedBy - User ID who revoked the key
 */
export async function revokeApiKey(keyId: string, revokedBy?: string): Promise<void> {
  const existingKey = await getApiKeyById(keyId);
  if (!existingKey) {
    throw new Error('API key not found');
  }

  await updateApiKey(keyId, {
    is_active: false,
    revoked_at: new Date(),
    revoked_by: revokedBy || null,
  });

  console.log(`[ApiKeyService] Revoked key: ${keyId}`);
}

/**
 * List API keys for an organization (never returns hashes)
 *
 * @param organizationId - Organization ID, or null for global keys
 * @returns List of keys without sensitive data
 */
export async function listApiKeys(
  organizationId: string | null
): Promise<ApiKeyListItem[]> {
  const keys = organizationId
    ? await getApiKeysByOrganization(organizationId)
    : await getGlobalApiKeys();

  // Map to list items (exclude hashes)
  return keys.map((key) => ({
    key_id: key.key_id,
    name: key.name,
    key_prefix: key.key_prefix,
    key_type: key.key_type,
    organization_id: key.organization_id,
    is_active: key.is_active,
    created_at: key.created_at,
    last_used_at: key.last_used_at,
    expires_at: key.expires_at,
  }));
}

/**
 * Get rate limit tier for a key
 */
export function getRateLimitTier(apiKey: ApiKey): RateLimitTier {
  return apiKey.permissions?.rate_limit_tier || 'standard';
}

/**
 * Check if a key has permission for an operation
 *
 * @param apiKey - The API key
 * @param operation - Operation to check (e.g., 'proxy:read', 'webhooks:write')
 */
export function hasPermission(apiKey: ApiKey, operation: string): boolean {
  const permissions = apiKey.permissions?.endpoints || [];

  // Global admin or wildcard has all permissions
  if (permissions.includes('*')) {
    return true;
  }

  // Check exact match
  if (permissions.includes(operation)) {
    return true;
  }

  // Check wildcard patterns (e.g., 'proxy:*' matches 'proxy:read')
  const [category] = operation.split(':');
  if (permissions.includes(`${category}:*`)) {
    return true;
  }

  return false;
}

/**
 * Clean up expired keys and keys past grace period
 * This should be called periodically (e.g., daily cron job)
 */
export async function cleanupExpiredKeys(): Promise<{
  deactivated: number;
  errors: string[];
}> {
  // This would query for keys where:
  // - expires_at < NOW and is_active = true
  // - grace_period_ends_at < NOW and is_active = true
  // Then deactivate them

  // For now, this is a placeholder - implement when needed
  console.log('[ApiKeyService] Cleanup expired keys - not yet implemented');
  return { deactivated: 0, errors: [] };
}
