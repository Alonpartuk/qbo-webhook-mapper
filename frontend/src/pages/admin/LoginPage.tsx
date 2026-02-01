/**
 * Admin Login Page
 *
 * Primary authentication via Microsoft SSO.
 * Magic link fallback available for development/testing.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/client';

interface AuthStatus {
  microsoft: {
    configured: boolean;
    tenantId?: string;
  };
  magicLink: {
    enabled: boolean;
  };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check for error in URL params
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    if (errorParam) {
      setError(messageParam || `Authentication failed: ${errorParam}`);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Fetch auth status
  useEffect(() => {
    async function fetchAuthStatus() {
      try {
        const response = await apiClient.get('/admin/auth/status');
        if (response.data.success) {
          setAuthStatus(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch auth status:', err);
      }
    }
    fetchAuthStatus();
  }, []);

  const handleMicrosoftLogin = () => {
    // Redirect to backend Microsoft auth endpoint
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    window.location.href = `${apiUrl}/admin/auth/microsoft`;
  };

  const handleMagicLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/admin/auth/magic-link', { email });
      if (response.data.success) {
        setMagicLinkSent(true);
        // In dev mode, the magic link URL is returned
        if (response.data.magicLinkUrl) {
          setMagicLinkUrl(response.data.magicLinkUrl);
        }
      } else {
        setError(response.data.error || 'Failed to send magic link');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">
            QBO Webhook Mapper
          </h1>
          <h2 className="mt-2 text-center text-xl text-gray-600">
            Admin Dashboard
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg p-8 space-y-6">
          {/* Microsoft SSO Button */}
          {authStatus?.microsoft?.configured && (
            <button
              onClick={handleMicrosoftLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Sign in with Microsoft
            </button>
          )}

          {/* Divider */}
          {authStatus?.microsoft?.configured && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>
          )}

          {/* Magic Link Section */}
          {!showMagicLink && authStatus?.microsoft?.configured ? (
            <button
              onClick={() => setShowMagicLink(true)}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
            >
              Sign in with email instead
            </button>
          ) : magicLinkSent ? (
            <div className="text-center space-y-4">
              <div className="text-green-600">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-700">
                Check your email for a login link.
              </p>
              {magicLinkUrl && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800 mb-2">
                    Development mode - Magic link:
                  </p>
                  <a
                    href={magicLinkUrl}
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    Click here to sign in
                  </a>
                </div>
              )}
              <button
                onClick={() => {
                  setMagicLinkSent(false);
                  setMagicLinkUrl(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLinkRequest} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send magic link'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-500">
          Authorized personnel only. Access is logged.
        </p>
      </div>
    </div>
  );
}
