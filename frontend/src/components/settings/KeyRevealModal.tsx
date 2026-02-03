/**
 * Key Reveal Modal
 *
 * One-time display of the full API key after creation/rotation.
 * Emphasizes that the key won't be shown again.
 */

import { useState } from 'react';
import { X, Key, Copy, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';

interface KeyRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string | null;
  keyName: string;
}

export default function KeyRevealModal({ isOpen, onClose, apiKey, keyName }: KeyRevealModalProps) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCopy = async () => {
    if (!apiKey) return;

    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => {
    if (!acknowledged) {
      if (!confirm('Are you sure? You will not be able to see this API key again.')) {
        return;
      }
    }
    setCopied(false);
    setShowKey(false);
    setAcknowledged(false);
    onClose();
  };

  const maskKey = (key: string) => {
    if (key.length <= 12) return key;
    return key.substring(0, 12) + '*'.repeat(key.length - 16) + key.substring(key.length - 4);
  };

  if (!isOpen || !apiKey) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop - solid dark overlay */}
      <div
        className="fixed inset-0 bg-gray-900 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Modal - fully opaque with enhanced shadow */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Key className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">API Key Created</h2>
                <p className="text-sm text-gray-500">{keyName}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Warning */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold">Save this key now!</p>
                  <p className="mt-1">
                    This is the only time you will see this API key. Copy it and store it securely.
                    If you lose it, you'll need to create a new one.
                  </p>
                </div>
              </div>
            </div>

            {/* Key Display */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Your API Key
              </label>
              <div className="relative">
                <div className="flex items-center gap-2 p-4 bg-gray-900 rounded-lg font-mono text-sm">
                  <code className="flex-1 text-green-400 break-all">
                    {showKey ? apiKey : maskKey(apiKey)}
                  </code>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={handleCopy}
                      className={`p-2 transition-colors ${
                        copied ? 'text-green-400' : 'text-gray-400 hover:text-white'
                      }`}
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              {copied && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Copied to clipboard!
                </p>
              )}
            </div>

            {/* Usage Example */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Usage Example
              </label>
              <div className="p-4 bg-gray-100 rounded-lg overflow-x-auto">
                <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
{`curl -X GET "https://api.example.com/api/v1/org/YOUR_ORG/proxy/data?type=customers" \\
  -H "X-API-Key: ${apiKey.substring(0, 20)}..."`}
                </pre>
              </div>
            </div>

            {/* Acknowledgment */}
            <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-700">
                I have copied and securely stored this API key. I understand it will not be shown again.
              </span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Key
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              disabled={!acknowledged}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
