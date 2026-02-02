import { useState, useEffect } from 'react';
import {
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Key,
  Server,
  UserX,
} from 'lucide-react';
import * as adminApi from '../../api/admin';
import { AuditLog, AuditLogFilters, AuditLogCategories } from '../../api/admin';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [categories, setCategories] = useState<AuditLogCategories>({});
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 50,
    offset: 0,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Filter form state
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [filterActorType, setFilterActorType] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    loadCategories();
    loadLogs();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadCategories = async () => {
    try {
      const cats = await adminApi.getAuditLogCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getAuditLogs(filters);
      setLogs(response.logs);
      setTotal(response.total);
      setHasMore(response.has_more);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setFilters({
      ...filters,
      offset: 0,
      category: filterCategory || undefined,
      action: filterAction || undefined,
      result: filterResult || undefined,
      actor_type: filterActorType || undefined,
      actor_email: filterSearch || undefined,
    });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterAction('');
    setFilterResult('');
    setFilterActorType('');
    setFilterSearch('');
    setFilters({
      limit: 50,
      offset: 0,
    });
    setShowFilters(false);
  };

  const nextPage = () => {
    setFilters({
      ...filters,
      offset: (filters.offset || 0) + (filters.limit || 50),
    });
  };

  const prevPage = () => {
    setFilters({
      ...filters,
      offset: Math.max(0, (filters.offset || 0) - (filters.limit || 50)),
    });
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failure':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'admin_user':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'api_key':
        return <Key className="w-4 h-4 text-purple-500" />;
      case 'system':
        return <Server className="w-4 h-4 text-gray-500" />;
      case 'anonymous':
        return <UserX className="w-4 h-4 text-orange-500" />;
      default:
        return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      auth: 'bg-blue-100 text-blue-700',
      user_mgmt: 'bg-purple-100 text-purple-700',
      api_key: 'bg-indigo-100 text-indigo-700',
      qbo: 'bg-green-100 text-green-700',
      webhook: 'bg-orange-100 text-orange-700',
      organization: 'bg-cyan-100 text-cyan-700',
      mapping: 'bg-pink-100 text-pink-700',
      system: 'bg-gray-100 text-gray-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Audit Logs</h1>
              <p className="mt-1 text-sm text-gray-500">
                Track all platform activity and security events
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showFilters ? 'bg-blue-100 text-blue-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <button
                onClick={loadLogs}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setFilterAction('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {Object.keys(categories).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace('_', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!filterCategory}
                >
                  <option value="">All Actions</option>
                  {filterCategory && categories[filterCategory]?.map((action) => (
                    <option key={action} value={action}>
                      {action.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                <select
                  value={filterResult}
                  onChange={(e) => setFilterResult(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Results</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actor Type</label>
                <select
                  value={filterActorType}
                  onChange={(e) => setFilterActorType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="admin_user">Admin User</option>
                  <option value="api_key">API Key</option>
                  <option value="system">System</option>
                  <option value="anonymous">Anonymous</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actor Email</label>
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Search by email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {logs.length} of {total} logs
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category / Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadgeColor(log.category)}`}>
                            {log.category.replace('_', ' ')}
                          </span>
                          <span className="text-sm text-gray-600">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getResultIcon(log.result)}
                          <span className="text-sm capitalize">{log.result}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getActorIcon(log.actor_type)}
                          <div className="text-sm">
                            <div className="text-gray-900">{log.actor_email || log.actor_id || 'Unknown'}</div>
                            <div className="text-gray-500 text-xs">{log.actor_type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 max-w-xs truncate">
                          {log.error_message && (
                            <span className="text-red-600">{log.error_message}</span>
                          )}
                          {!log.error_message && log.target_type && (
                            <span>Target: {log.target_type} {log.target_id && `(${log.target_id.slice(0, 8)}...)`}</span>
                          )}
                          {!log.error_message && !log.target_type && log.request_path && (
                            <span>{log.request_method} {log.request_path}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1} of {Math.ceil(total / (filters.limit || 50))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={prevPage}
              disabled={(filters.offset || 0) === 0}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={nextPage}
              disabled={!hasMore}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
