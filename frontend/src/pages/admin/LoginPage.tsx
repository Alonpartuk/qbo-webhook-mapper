/**
 * Admin Login Page
 *
 * Microsoft SSO is the ONLY authentication method.
 * Supports "Remember Me" for 30-day sessions.
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
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
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
        setError('Failed to connect to authentication service');
      }
    }
    fetchAuthStatus();
  }, []);

  const handleMicrosoftLogin = () => {
    setLoading(true);
    // Redirect to backend Microsoft auth endpoint with rememberMe parameter
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    const rememberParam = rememberMe ? '?rememberMe=true' : '';
    window.location.href = `${apiUrl}/admin/auth/microsoft${rememberParam}`;
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
          {authStatus?.microsoft?.configured ? (
            <>
              <button
                onClick={handleMicrosoftLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                  </svg>
                )}
                {loading ? 'Redirecting...' : 'Sign in with Microsoft'}
              </button>

              {/* Remember Me Checkbox */}
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-700 cursor-pointer"
                >
                  Remember me for 30 days
                </label>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500">
              {authStatus === null ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              ) : (
                <p>Microsoft SSO is not configured. Please contact your administrator.</p>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-500">
          Authorized personnel only. Access is logged.
        </p>
      </div>
    </div>
  );
}
