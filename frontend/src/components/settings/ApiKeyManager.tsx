/**
 * API Key Manager Component
 *
 * Displays list of API keys for an organization with actions:
 * - Create new key
 * - Rotate existing key
 * - Revoke key
 */

import { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { ApiKey, CreateApiKeyResult, RotateApiKeyResult } from '../../types';
import * as adminApi from '../../api/admin';
import CreateKeyModal from './CreateKeyModal';
import KeyRevealModal from './KeyRevealModal';

interface ApiKeyManagerProps {
  organizationId: string;
  organizationSlug: string;
}

export default function ApiKeyManager({ organizationId, organizationSlug }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedKeyName, setRevealedKeyName] = useState<string>('');

  // Action states
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, [organizationId]);

  const loadKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getApiKeys(organizationId);
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (name: string) => {
    try {
      const result: CreateApiKeyResult = await adminApi.createApiKey(organizationId, { name });
      setRevealedKey(result.key);
      setRevealedKeyName(result.name);
      setShowCreateModal(false);
      setShowRevealModal(true);
      await loadKeys();
    } catch (err) {
      throw err;
    }
  };

  const handleRotateKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to rotate the key "${keyName}"? The old key will remain valid for 24 hours.`)) {
      return;
    }

    setRotatingKeyId(keyId);
    try {
      const result: RotateApiKeyResult = await adminApi.rotateApiKey(organizationId, keyId);
      setRevealedKey(result.new_key);
      setRevealedKeyName(`${keyName} (Rotated)`);
      setShowRevealModal(true);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate key');
    } finally {
      setRotatingKeyId(null);
    }
  };

  const handleRevokeKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke the key "${keyName}"? This action cannot be undone and the key will immediately stop working.`)) {
      return;
    }

    setRevokingKeyId(keyId);
    try {
      await adminApi.revokeApiKey(organizationId, keyId);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    } finally {
      setRevokingKeyId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const getKeyStatus = (key: ApiKey) => {
    if (key.revoked_at) {
      return { label: 'Revoked', color: 'bg-red-100 text-red-700' };
    }
    if (key.grace_period_ends_at && new Date(key.grace_period_ends_at) > new Date()) {
      return { label: 'Grace Period', color: 'bg-yellow-100 text-yellow-700' };
    }
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return { label: 'Expired', color: 'bg-gray-100 text-gray-700' };
    }
    if (!key.is_active) {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-700' };
    }
    return { label: 'Active', color: 'bg-green-100 text-green-700' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">API Keys</h2>
          <p className="text-sm text-gray-500">
            Manage API keys for authenticating requests to the Proxy API
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Create Key
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Key className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No API Keys</h3>
          <p className="mt-2 text-gray-500">
            Create an API key to authenticate requests to the Proxy API.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
            Create Your First Key
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {keys.map((key) => {
                const status = getKeyStatus(key);
                const isRevoked = !!key.revoked_at;
                const isProcessing = rotatingKeyId === key.key_id || revokingKeyId === key.key_id;

                return (
                  <tr key={key.key_id} className={isRevoked ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Key className={`w-4 h-4 ${isRevoked ? 'text-gray-300' : 'text-gray-500'}`} />
                        <span className={`font-medium ${isRevoked ? 'text-gray-400' : 'text-gray-900'}`}>
                          {key.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className={`text-sm font-mono ${isRevoked ? 'text-gray-400' : 'text-gray-600'}`}>
                        qbo_live_...{key.key_prefix}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      {key.grace_period_ends_at && new Date(key.grace_period_ends_at) > new Date() && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-yellow-600">
                          <Clock className="w-3 h-3" />
                          Expires {formatDate(key.grace_period_ends_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(key.last_used_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(key.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {!isRevoked && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRotateKey(key.key_id, key.name)}
                            disabled={isProcessing}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Rotate key"
                          >
                            {rotatingKeyId === key.key_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRevokeKey(key.key_id, key.name)}
                            disabled={isProcessing}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Revoke key"
                          >
                            {revokingKeyId === key.key_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage Example */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Usage Example</h3>
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-gray-300 font-mono">
{`curl -X GET "https://api.example.com/api/v1/org/${organizationSlug}/proxy/data?type=customers" \\
  -H "X-API-Key: qbo_live_YOUR_API_KEY"`}
          </pre>
        </div>
      </div>

      {/* Modals */}
      <CreateKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateKey}
      />

      <KeyRevealModal
        isOpen={showRevealModal}
        onClose={() => {
          setShowRevealModal(false);
          setRevealedKey(null);
          setRevealedKeyName('');
        }}
        apiKey={revealedKey}
        keyName={revealedKeyName}
      />
    </div>
  );
}
