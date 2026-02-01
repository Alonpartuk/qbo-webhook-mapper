/**
 * Magic Link Verify Page
 *
 * Handles magic link verification from email.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/client';

export default function MagicLinkVerifyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    async function verifyToken() {
      const token = searchParams.get('token');
      const email = searchParams.get('email');

      if (!token || !email) {
        setError('Invalid magic link');
        setVerifying(false);
        return;
      }

      try {
        const response = await apiClient.post('/admin/auth/verify', {
          token,
          email,
        });

        if (response.data.success && response.data.data?.token) {
          login(response.data.data.token);
          navigate('/admin');
        } else {
          setError(response.data.error || 'Verification failed');
          setVerifying(false);
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || 'Verification failed');
        setVerifying(false);
      }
    }

    verifyToken();
  }, [searchParams, login, navigate]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying your login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
          <p className="font-medium">Verification Failed</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800"
          >
            Return to login
          </button>
        </div>
      </div>
    </div>
  );
}
