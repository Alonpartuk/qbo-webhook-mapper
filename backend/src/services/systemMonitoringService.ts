/**
 * System Monitoring Service
 *
 * Aggregates connection status and sync health across all tenants.
 * Provides a global view for admin dashboard monitoring.
 */

import {
  getOrganizations,
  getAllActiveTokens,
  getSyncLogs,
  getSources,
} from './dataService';
import { Organization, OAuthToken, SyncLog } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface TenantConnectionStatus {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  plan_tier: string;
  is_active: boolean;
  qbo_connected: boolean;
  realm_id?: string;
  qbo_company_name?: string;
  token_status?: 'active' | 'expired' | 'error' | 'revoked' | 'disconnected' | 'refresh_failed';
  token_expires_at?: Date;
  last_sync_at?: Date;
  last_sync_status?: 'success' | 'failed';
  total_sources: number;
  sync_stats_24h: {
    total: number;
    success: number;
    failed: number;
  };
  created_at: Date;
}

export interface SystemHealthSummary {
  total_organizations: number;
  active_organizations: number;
  connected_organizations: number;
  disconnected_organizations: number;
  expiring_tokens_24h: number;
  failed_syncs_24h: number;
  total_syncs_24h: number;
  success_rate_24h: number;
}

export interface TokenExpiryAlert {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  realm_id: string;
  qbo_company_name?: string;
  expires_at: Date;
  hours_until_expiry: number;
}

export interface RecentSyncFailure {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  log_id: string;
  source_id: string;
  error_message?: string;
  error_code?: string;
  created_at: Date;
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Get connection status for all tenants
 */
export async function getAllTenantConnections(): Promise<TenantConnectionStatus[]> {
  const [organizations, tokens] = await Promise.all([
    getOrganizations(),
    getAllActiveTokens(),
  ]);

  // Create a map of org_id -> token for quick lookup
  const tokenMap = new Map<string, OAuthToken>();
  for (const token of tokens) {
    tokenMap.set(token.organization_id, token);
  }

  // Get sync logs and source counts for each organization
  const connectionStatuses: TenantConnectionStatus[] = [];

  for (const org of organizations) {
    const token = tokenMap.get(org.organization_id);

    // Get sources count
    let sourceCount = 0;
    try {
      const sources = await getSources(org.organization_id);
      sourceCount = sources.length;
    } catch {
      // Ignore errors for source count
    }

    // Get sync stats for last 24 hours
    let syncStats = { total: 0, success: 0, failed: 0 };
    let lastSync: SyncLog | undefined;

    try {
      const logs = await getSyncLogs(org.organization_id, 100);
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Filter to last 24 hours
      const recentLogs = logs.filter(log => new Date(log.created_at) > yesterday);

      syncStats.total = recentLogs.length;
      syncStats.success = recentLogs.filter(log => log.status === 'success').length;
      syncStats.failed = recentLogs.filter(log => log.status === 'failed').length;

      // Get the most recent completed sync
      lastSync = logs.find(log => log.status === 'success' || log.status === 'failed');
    } catch {
      // Ignore errors for sync logs
    }

    connectionStatuses.push({
      organization_id: org.organization_id,
      organization_name: org.name,
      organization_slug: org.slug,
      plan_tier: org.plan_tier,
      is_active: org.is_active,
      qbo_connected: !!token && token.is_active,
      realm_id: token?.realm_id,
      qbo_company_name: token?.qbo_company_name,
      token_status: token?.sync_status,
      token_expires_at: token?.access_token_expires_at,
      last_sync_at: token?.last_sync_at || lastSync?.completed_at,
      last_sync_status: lastSync?.status === 'success' ? 'success' : lastSync?.status === 'failed' ? 'failed' : undefined,
      total_sources: sourceCount,
      sync_stats_24h: syncStats,
      created_at: org.created_at,
    });
  }

  // Sort by organization name
  connectionStatuses.sort((a, b) => a.organization_name.localeCompare(b.organization_name));

  return connectionStatuses;
}

/**
 * Get system health summary
 */
export async function getSystemHealthSummary(): Promise<SystemHealthSummary> {
  const connections = await getAllTenantConnections();

  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const totalOrganizations = connections.length;
  const activeOrganizations = connections.filter(c => c.is_active).length;
  const connectedOrganizations = connections.filter(c => c.qbo_connected).length;
  const disconnectedOrganizations = activeOrganizations - connectedOrganizations;

  // Count tokens expiring in next 24 hours
  const expiringTokens24h = connections.filter(c => {
    if (!c.token_expires_at) return false;
    const expiresAt = new Date(c.token_expires_at);
    return expiresAt > now && expiresAt < in24Hours;
  }).length;

  // Aggregate sync stats
  let totalSyncs24h = 0;
  let failedSyncs24h = 0;

  for (const conn of connections) {
    totalSyncs24h += conn.sync_stats_24h.total;
    failedSyncs24h += conn.sync_stats_24h.failed;
  }

  const successRate24h = totalSyncs24h > 0
    ? Math.round(((totalSyncs24h - failedSyncs24h) / totalSyncs24h) * 100)
    : 100;

  return {
    total_organizations: totalOrganizations,
    active_organizations: activeOrganizations,
    connected_organizations: connectedOrganizations,
    disconnected_organizations: disconnectedOrganizations,
    expiring_tokens_24h: expiringTokens24h,
    failed_syncs_24h: failedSyncs24h,
    total_syncs_24h: totalSyncs24h,
    success_rate_24h: successRate24h,
  };
}

/**
 * Get tokens expiring within specified hours
 */
export async function getExpiringTokenAlerts(withinHours: number = 24): Promise<TokenExpiryAlert[]> {
  const [organizations, tokens] = await Promise.all([
    getOrganizations(),
    getAllActiveTokens(),
  ]);

  const orgMap = new Map<string, Organization>();
  for (const org of organizations) {
    orgMap.set(org.organization_id, org);
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + withinHours * 60 * 60 * 1000);

  const alerts: TokenExpiryAlert[] = [];

  for (const token of tokens) {
    if (!token.is_active || !token.access_token_expires_at) continue;

    const expiresAt = new Date(token.access_token_expires_at);
    if (expiresAt > now && expiresAt < cutoff) {
      const org = orgMap.get(token.organization_id);
      if (!org) continue;

      const hoursUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000));

      alerts.push({
        organization_id: org.organization_id,
        organization_name: org.name,
        organization_slug: org.slug,
        realm_id: token.realm_id,
        qbo_company_name: token.qbo_company_name,
        expires_at: expiresAt,
        hours_until_expiry: hoursUntilExpiry,
      });
    }
  }

  // Sort by expiry time (soonest first)
  alerts.sort((a, b) => a.expires_at.getTime() - b.expires_at.getTime());

  return alerts;
}

/**
 * Get recent sync failures across all organizations
 */
export async function getRecentSyncFailures(limit: number = 20): Promise<RecentSyncFailure[]> {
  const organizations = await getOrganizations();

  const orgMap = new Map<string, Organization>();
  for (const org of organizations) {
    orgMap.set(org.organization_id, org);
  }

  const allFailures: RecentSyncFailure[] = [];

  // Get sync logs from each organization
  for (const org of organizations) {
    try {
      const logs = await getSyncLogs(org.organization_id, 50);
      const failures = logs.filter(log => log.status === 'failed');

      for (const failure of failures) {
        allFailures.push({
          organization_id: org.organization_id,
          organization_name: org.name,
          organization_slug: org.slug,
          log_id: failure.log_id,
          source_id: failure.source_id,
          error_message: failure.error_message,
          error_code: failure.error_code,
          created_at: failure.created_at,
        });
      }
    } catch {
      // Ignore errors for individual orgs
    }
  }

  // Sort by created_at descending (most recent first)
  allFailures.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return allFailures.slice(0, limit);
}

/**
 * Get summary statistics for a quick health check
 */
export async function getQuickHealthCheck(): Promise<{
  healthy: boolean;
  issues: string[];
  summary: SystemHealthSummary;
}> {
  const summary = await getSystemHealthSummary();
  const issues: string[] = [];

  // Check for issues
  if (summary.disconnected_organizations > 0) {
    issues.push(`${summary.disconnected_organizations} organization(s) disconnected from QBO`);
  }

  if (summary.expiring_tokens_24h > 0) {
    issues.push(`${summary.expiring_tokens_24h} token(s) expiring in next 24 hours`);
  }

  if (summary.success_rate_24h < 90) {
    issues.push(`Low sync success rate: ${summary.success_rate_24h}%`);
  }

  if (summary.failed_syncs_24h > 10) {
    issues.push(`High number of failed syncs: ${summary.failed_syncs_24h} in last 24h`);
  }

  return {
    healthy: issues.length === 0,
    issues,
    summary,
  };
}
