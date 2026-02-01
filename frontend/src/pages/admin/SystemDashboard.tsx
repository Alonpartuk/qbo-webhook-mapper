/**
 * System Dashboard Page
 *
 * Global overview of all tenant connections, token health,
 * and sync status across the platform.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Building2,
  RefreshCw,
  Loader2,
  Server,
  Zap,
  AlertCircle,
} from 'lucide-react';
import {
  TenantConnectionStatus,
  SystemHealthResponse,
  TokenExpiryAlert,
  RecentSyncFailure,
} from '../../types';
import * as adminApi from '../../api/admin';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export default function SystemDashboard() {
  const [connections, setConnections] = useState<TenantConnectionStatus[]>([]);
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [expiringTokens, setExpiringTokens] = useState<TokenExpiryAlert[]>([]);
  const [failures, setFailures] = useState<RecentSyncFailure[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingState('loading');
    setError(null);

    try {
      const [connectionsData, healthData, tokensData, failuresData] = await Promise.all([
        adminApi.getSystemConnections(),
        adminApi.getSystemHealth(),
        adminApi.getExpiringTokens(48), // 48 hour lookback
        adminApi.getRecentSyncFailures(10),
      ]);

      setConnections(connectionsData);
      setHealth(healthData);
      setExpiringTokens(tokensData);
      setFailures(failuresData);
      setLastRefresh(new Date());
      setLoadingState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system data');
      setLoadingState('error');
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'expired':
      case 'error':
      case 'refresh_failed':
        return 'text-red-600 bg-red-100';
      case 'revoked':
      case 'disconnected':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">Failed to load system data</h2>
          <p className="mt-2 text-gray-500">{error}</p>
          <button
            onClick={loadData}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">System Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Global overview of all tenant connections
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
              <button
                onClick={loadData}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Health Status Banner */}
        {health && (
          <div
            className={`mb-6 p-4 rounded-xl border ${
              health.status === 'healthy'
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {health.status === 'healthy' ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              )}
              <div>
                <p
                  className={`font-medium ${
                    health.status === 'healthy' ? 'text-green-900' : 'text-yellow-900'
                  }`}
                >
                  System Status: {health.status === 'healthy' ? 'All Systems Operational' : 'Attention Required'}
                </p>
                {health.issues.length > 0 && (
                  <ul className="mt-1 text-sm text-yellow-800">
                    {health.issues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {health && (
          <div className="grid grid-cols-4 gap-6 mb-8">
            <StatCard
              icon={<Building2 className="w-5 h-5" />}
              label="Organizations"
              value={health.summary.active_organizations}
              subtext={`${health.summary.total_organizations} total`}
              color="blue"
            />
            <StatCard
              icon={<Zap className="w-5 h-5" />}
              label="Connected"
              value={health.summary.connected_organizations}
              subtext={`${health.summary.disconnected_organizations} disconnected`}
              color="green"
            />
            <StatCard
              icon={<Activity className="w-5 h-5" />}
              label="Syncs (24h)"
              value={health.summary.total_syncs_24h}
              subtext={`${health.summary.success_rate_24h}% success rate`}
              color="purple"
            />
            <StatCard
              icon={<AlertTriangle className="w-5 h-5" />}
              label="Alerts"
              value={health.summary.expiring_tokens_24h + health.summary.failed_syncs_24h}
              subtext={`${health.summary.expiring_tokens_24h} tokens expiring`}
              color={health.summary.failed_syncs_24h > 0 ? 'red' : 'gray'}
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Main Connections Table */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">All Tenant Connections</h2>
                <p className="text-sm text-gray-500">
                  {connections.length} organizations • {connections.filter(c => c.qbo_connected).length} connected
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Organization
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        QBO Connection
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Realm ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Last Sync
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        24h Stats
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {connections.map((conn) => (
                      <tr key={conn.organization_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Link
                            to={`/admin/org/${conn.organization_slug}`}
                            className="flex items-center gap-3 hover:text-blue-600"
                          >
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{conn.organization_name}</p>
                              <p className="text-xs text-gray-500">/{conn.organization_slug}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          {conn.qbo_connected ? (
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                  conn.token_status
                                )}`}
                              >
                                {conn.token_status || 'active'}
                              </span>
                              {conn.qbo_company_name && (
                                <span className="text-xs text-gray-500 truncate max-w-[120px]">
                                  {conn.qbo_company_name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                              <XCircle className="w-3 h-3" />
                              Not connected
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="text-xs font-mono text-gray-600">
                            {conn.realm_id || '—'}
                          </code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {conn.last_sync_at ? (
                            <div className="flex items-center gap-2">
                              {conn.last_sync_status === 'success' ? (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              ) : conn.last_sync_status === 'failed' ? (
                                <XCircle className="w-3 h-3 text-red-500" />
                              ) : null}
                              <span className="text-sm text-gray-600">
                                {formatRelativeTime(conn.last_sync_at)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Never</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-600">
                              {conn.sync_stats_24h.success}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className="text-red-600">
                              {conn.sync_stats_24h.failed}
                            </span>
                            <span className="text-gray-400">
                              ({conn.sync_stats_24h.total} total)
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Alerts Sidebar */}
          <div className="space-y-6">
            {/* Token Expiry Alerts */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-yellow-50">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <h3 className="text-sm font-medium text-yellow-900">Token Expiry Alerts</h3>
                </div>
              </div>
              <div className="p-4">
                {expiringTokens.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No tokens expiring soon
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {expiringTokens.slice(0, 5).map((alert) => (
                      <li key={`${alert.organization_id}-${alert.realm_id}`} className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <Link
                            to={`/admin/org/${alert.organization_slug}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600"
                          >
                            {alert.organization_name}
                          </Link>
                          <p className="text-xs text-gray-500">
                            Expires in {alert.hours_until_expiry}h
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Recent Failures */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-red-50">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <h3 className="text-sm font-medium text-red-900">Recent Sync Failures</h3>
                </div>
              </div>
              <div className="p-4">
                {failures.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No recent failures
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {failures.slice(0, 5).map((failure) => (
                      <li key={failure.log_id} className="flex items-start gap-3">
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <Link
                            to={`/admin/org/${failure.organization_slug}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600"
                          >
                            {failure.organization_name}
                          </Link>
                          <p className="text-xs text-red-600 truncate">
                            {failure.error_code || failure.error_message || 'Unknown error'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatRelativeTime(failure.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext: string;
  color: 'blue' | 'green' | 'purple' | 'red' | 'gray';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <p className="text-xs text-gray-500 mt-1">{subtext}</p>
    </div>
  );
}
