/**
 * API Usage Logging Service
 *
 * Logs API usage to BigQuery api_usage_logs table for:
 * - Security auditing (unauthorized access attempts)
 * - Performance monitoring (latency tracking)
 * - Usage analytics (endpoint popularity, error rates)
 */

import { v4 as uuidv4 } from 'uuid';
import config from '../config';

// API Usage Log entry interface
export interface ApiUsageLog {
  log_id: string;
  timestamp: Date;
  organization_id?: string;
  api_key_id?: string;
  endpoint: string;
  method: string;
  query_params?: string;
  status_code: number;
  response_time_ms: number;
  request_size_bytes?: number;
  response_size_bytes?: number;
  error_code?: string;
  user_agent?: string;
  ip_address?: string;
}

// In-memory storage for mock mode
const usageLogs: ApiUsageLog[] = [];

/**
 * Log API usage entry
 * Uses async write to avoid blocking the request
 */
export async function logApiUsage(entry: Omit<ApiUsageLog, 'log_id'>): Promise<void> {
  const logEntry: ApiUsageLog = {
    log_id: uuidv4(),
    ...entry,
  };

  // Use mock or BigQuery based on environment
  if (config.useMockData) {
    await logToMock(logEntry);
  } else {
    await logToBigQuery(logEntry);
  }
}

/**
 * Log to in-memory storage (mock mode)
 */
async function logToMock(entry: ApiUsageLog): Promise<void> {
  usageLogs.push(entry);

  // Keep only last 10000 entries in memory
  if (usageLogs.length > 10000) {
    usageLogs.shift();
  }

  // Log to console in development for visibility
  if (process.env.NODE_ENV !== 'production') {
    const statusColor = entry.status_code >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(
      `[API Usage] ${statusColor}${entry.status_code}\x1b[0m ${entry.method} ${entry.endpoint} ` +
        `${entry.response_time_ms}ms ${entry.organization_id || 'anonymous'} ${entry.ip_address || ''}`
    );
  }
}

/**
 * Log to BigQuery (production mode)
 */
async function logToBigQuery(entry: ApiUsageLog): Promise<void> {
  try {
    const { BigQuery } = await import('@google-cloud/bigquery');
    const bigquery = new BigQuery({
      projectId: config.bigquery.projectId,
    });

    const dataset = bigquery.dataset(config.bigquery.dataset);
    const table = dataset.table('api_usage_logs');

    // Insert row asynchronously (fire and forget)
    await table.insert([
      {
        log_id: entry.log_id,
        timestamp: entry.timestamp.toISOString(),
        organization_id: entry.organization_id || null,
        api_key_id: entry.api_key_id || null,
        endpoint: entry.endpoint,
        method: entry.method,
        query_params: entry.query_params || null,
        status_code: entry.status_code,
        response_time_ms: entry.response_time_ms,
        request_size_bytes: entry.request_size_bytes || null,
        response_size_bytes: entry.response_size_bytes || null,
        error_code: entry.error_code || null,
        user_agent: entry.user_agent || null,
        ip_address: entry.ip_address || null,
      },
    ]);
  } catch (error) {
    // Log error but don't fail the request
    console.error('[UsageLogging] Failed to write to BigQuery:', error);
  }
}

/**
 * Get recent usage logs (for admin dashboard)
 */
export async function getRecentUsageLogs(
  limit: number = 100,
  organizationId?: string
): Promise<ApiUsageLog[]> {
  if (config.useMockData) {
    let logs = [...usageLogs].reverse();
    if (organizationId) {
      logs = logs.filter((l) => l.organization_id === organizationId);
    }
    return logs.slice(0, limit);
  }

  // BigQuery implementation
  try {
    const { BigQuery } = await import('@google-cloud/bigquery');
    const bigquery = new BigQuery({
      projectId: config.bigquery.projectId,
    });

    let query = `
      SELECT *
      FROM \`${config.bigquery.projectId}.${config.bigquery.dataset}.api_usage_logs\`
    `;

    if (organizationId) {
      query += ` WHERE organization_id = @organizationId`;
    }

    query += ` ORDER BY timestamp DESC LIMIT @limit`;

    const [rows] = await bigquery.query({
      query,
      params: { organizationId, limit },
    });

    return rows.map((row: Record<string, unknown>) => ({
      log_id: row.log_id as string,
      timestamp: new Date(row.timestamp as string),
      organization_id: row.organization_id as string | undefined,
      api_key_id: row.api_key_id as string | undefined,
      endpoint: row.endpoint as string,
      method: row.method as string,
      query_params: row.query_params as string | undefined,
      status_code: row.status_code as number,
      response_time_ms: row.response_time_ms as number,
      request_size_bytes: row.request_size_bytes as number | undefined,
      response_size_bytes: row.response_size_bytes as number | undefined,
      error_code: row.error_code as string | undefined,
      user_agent: row.user_agent as string | undefined,
      ip_address: row.ip_address as string | undefined,
    }));
  } catch (error) {
    console.error('[UsageLogging] Failed to query BigQuery:', error);
    return [];
  }
}

/**
 * Get usage statistics for an organization
 */
export async function getUsageStats(
  organizationId: string,
  hours: number = 24
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}> {
  if (config.useMockData) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const orgLogs = usageLogs.filter(
      (l) => l.organization_id === organizationId && l.timestamp >= cutoff
    );

    const totalRequests = orgLogs.length;
    const successfulRequests = orgLogs.filter((l) => l.status_code < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const avgLatencyMs =
      orgLogs.length > 0
        ? Math.round(orgLogs.reduce((sum, l) => sum + l.response_time_ms, 0) / orgLogs.length)
        : 0;

    // Count endpoints
    const endpointCounts = new Map<string, number>();
    orgLogs.forEach((l) => {
      endpointCounts.set(l.endpoint, (endpointCounts.get(l.endpoint) || 0) + 1);
    });

    const topEndpoints = Array.from(endpointCounts.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      avgLatencyMs,
      topEndpoints,
    };
  }

  // BigQuery implementation would go here
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgLatencyMs: 0,
    topEndpoints: [],
  };
}

/**
 * Get all usage logs (for testing/debugging)
 */
export function getAllUsageLogs(): ApiUsageLog[] {
  return [...usageLogs];
}

/**
 * Clear usage logs (for testing)
 */
export function clearUsageLogs(): void {
  usageLogs.length = 0;
}
