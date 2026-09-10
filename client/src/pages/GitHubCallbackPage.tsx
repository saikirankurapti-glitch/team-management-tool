import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { fetchApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const GitHubCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokenAndUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(true);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

      if (errorParam) {
        setIsProcessing(false);
        setError(errorDesc || 'GitHub login was cancelled or denied.');
        return;
      }

      if (!code) {
        setIsProcessing(false);
        setError('Missing authorization code from GitHub callback.');
        return;
      }

      try {
        const state = searchParams.get('state');
        const res = await fetchApi<{ success: boolean; token: string; user: any }>('/auth/github/callback', {
          method: 'POST',
          body: JSON.stringify({ code, state }),
        });

        if (res.token && res.user) {
          localStorage.setItem('token', res.token);
          if (setTokenAndUser) {
            setTokenAndUser(res.token, res.user);
          }
          window.location.href = '/';
        } else {
          throw new Error('Authentication succeeded but session token was missing.');
        }
      } catch (err: any) {
        setIsProcessing(false);
        setError(err.message || 'GitHub authentication failed. Please try again.');
      }
    };

    processCallback();
  }, [searchParams, navigate, setTokenAndUser]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md ent-panel p-8 space-y-6 text-center shadow-2xl border border-slate-800">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">GitHub Authentication</h2>
          <p className="text-xs text-slate-400 mt-1">Authenticating your account with GitHub OAuth...</p>
        </div>

        {isProcessing && (
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="text-xs font-mono text-slate-400">Exchanging credentials and verifying session...</span>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs flex items-start space-x-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full ent-btn-primary flex items-center justify-center space-x-2 text-xs py-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Sign In</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
