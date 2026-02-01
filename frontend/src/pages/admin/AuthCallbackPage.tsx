/**
 * Auth Callback Page
 *
 * Handles the OAuth callback after Microsoft SSO.
 * Extracts the JWT token from URL and stores it.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    if (errorParam) {
      setError(messageParam || `Authentication failed: ${errorParam}`);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      return;
    }

    if (token) {
      // Store token and redirect to admin dashboard
      login(token);
      navigate('/admin');
    } else {
      setError('No authentication token received');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
            <p className="font-medium">Authentication Error</p>
            <p className="text-sm mt-1">{error}</p>
            <p className="text-xs mt-2 text-gray-500">
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
