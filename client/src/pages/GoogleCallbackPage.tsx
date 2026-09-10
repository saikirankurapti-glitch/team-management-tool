import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Loader2, Send, CheckCircle2, Lock } from 'lucide-react';
import { fetchApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const GoogleCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokenAndUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(true);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);
  const [attemptedEmail, setAttemptedEmail] = useState<string>('');
  const [accessRequestSent, setAccessRequestSent] = useState<boolean>(false);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [organizationName, setOrganizationName] = useState<string>('TMP Organization');
  const [requestStatus, setRequestStatus] = useState<string>('Pending');
  const [requestedAt, setRequestedAt] = useState<string>('');

  const [errorType, setErrorType] = useState<'GOOGLE_OAUTH_DENIED' | 'APPLICATION_ACCESS_DENIED' | 'GENERIC_ERROR' | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

      // Layer 1: Google OAuth Error Handling
      if (errorParam) {
        setIsProcessing(false);
        if (errorParam === 'access_denied') {
          setErrorType('GOOGLE_OAUTH_DENIED');
          setError(
            'Google authorization was denied.\n\nThis application is currently available only to approved Google test accounts.\n\nIf you are a team member, make sure your Google account has been added as an approved test user.'
          );
        } else {
          setErrorType('GENERIC_ERROR');
          setError(errorDesc || `Google Workspace authorization returned error: ${errorParam}`);
        }
        return;
      }

      if (!code) {
        setIsProcessing(false);
        setErrorType('GENERIC_ERROR');
        setError('Missing authorization code from Google OAuth callback.');
        return;
      }

      try {
        const state = searchParams.get('state');
        const token = localStorage.getItem('token');

        const endpoint = token ? '/integrations/google/callback' : '/auth/google/callback';

        const res = await fetchApi<{
          success: boolean;
          token?: string;
          user?: any;
          connection?: any;
          error?: any;
        }>(endpoint, {
          method: 'POST',
          body: JSON.stringify({ code, state }),
        });

        if (res.token && res.user) {
          localStorage.setItem('token', res.token);
          if (setTokenAndUser) {
            setTokenAndUser(res.token, res.user);
          }
          window.location.href = '/';
        } else if (res.success) {
          window.location.href = '/integrations';
        } else {
          throw new Error('Authentication completed, but server did not return valid session payload.');
        }
      } catch (err: any) {
        setIsProcessing(false);
        const errMsg = err.message || 'Google Workspace authentication failed.';
        if (
          errMsg.includes('Access Restricted') ||
          errMsg.includes('Access Request Pending') ||
          errMsg.includes('not authorized') ||
          errMsg.includes('allowlist') ||
          err?.code === 'UNAUTHORIZED_GOOGLE_ACCOUNT'
        ) {
          setErrorType('APPLICATION_ACCESS_DENIED');
          setIsUnauthorized(true);
          setError(
            'Your Google account has been authenticated successfully, but you are not yet authorized to access this organization.\n\nYour access request has been sent to the organization administrator.'
          );
          if (err?.email) {
            setAttemptedEmail(err.email);
          }
          if (err?.organizationName) {
            setOrganizationName(err.organizationName);
          }
          if (err?.requestedAt) {
            setRequestedAt(new Date(err.requestedAt).toLocaleString());
          } else {
            setRequestedAt(new Date().toLocaleString());
          }
          if (err?.requestStatus) {
            setRequestStatus(err.requestStatus === 'APPROVED' ? 'Approved' : err.requestStatus === 'REJECTED' ? 'Rejected' : 'Pending');
          }
          setAccessRequestSent(true);
        } else {
          setErrorType('GENERIC_ERROR');
          setError(errMsg);
        }
      }
    };

    processCallback();
  }, [searchParams, navigate, setTokenAndUser]);

  const handleRequestAccess = async () => {
    setIsRequesting(true);
    try {
      await fetchApi('/auth/request-access', {
        method: 'POST',
        body: JSON.stringify({
          email: attemptedEmail || 'Google User',
          provider: 'GOOGLE',
        }),
      });
      setAccessRequestSent(true);
      setRequestStatus('Pending');
      setRequestedAt(new Date().toLocaleString());
    } catch (e: any) {
      setError(e.message || 'Failed to submit access request.');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md ent-panel p-8 space-y-6 text-center shadow-2xl border border-slate-800">
        <div className="flex justify-center">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isUnauthorized
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-rose-600/20 border border-rose-500/30 text-rose-400'
            }`}
          >
            {isUnauthorized ? <Lock className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">
            {errorType === 'GOOGLE_OAUTH_DENIED'
              ? 'Google Authorization Denied'
              : isUnauthorized
              ? 'Access Request Pending'
              : 'Google Workspace Authentication'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {errorType === 'GOOGLE_OAUTH_DENIED'
              ? 'Google Cloud OAuth Testing Mode'
              : isUnauthorized
              ? 'Private Organization Closed Team Policy'
              : 'Verifying identity with Google OAuth 2.0...'}
          </p>
        </div>

        {isProcessing && (
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
            <span className="text-xs font-mono text-slate-400">Verifying authorized allowlist membership...</span>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <div
              className={`p-3.5 rounded text-xs flex items-start space-x-2.5 text-left leading-relaxed whitespace-pre-line ${
                errorType === 'GOOGLE_OAUTH_DENIED'
                  ? 'bg-rose-950/40 border border-rose-500/40 text-rose-200'
                  : isUnauthorized
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>

            {/* Diagnostic Information */}
            {isUnauthorized && (
              <div className="p-3 bg-slate-900/90 border border-slate-800/80 rounded text-left space-y-1.5 text-xs font-mono">
                <div className="text-[11px] font-sans font-semibold text-slate-300 pb-1 border-b border-slate-800 flex items-center justify-between">
                  <span>Authorization Diagnostics</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    LAYER 2
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Authenticated identity:</span>
                  <span className="text-slate-200 font-medium truncate max-w-[200px]" title={attemptedEmail}>
                    {attemptedEmail || 'Authenticated Google Account'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Provider:</span>
                  <span className="text-slate-200 font-medium">Google</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Authorization:</span>
                  <span className="text-rose-400 font-medium">Not authorized</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Organization:</span>
                  <span className="text-slate-200 font-medium">{organizationName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Request status:</span>
                  <span
                    className={`font-medium ${
                      requestStatus === 'Pending'
                        ? 'text-amber-400'
                        : requestStatus === 'Approved'
                        ? 'text-emerald-400'
                        : requestStatus === 'Rejected'
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {requestStatus}
                  </span>
                </div>
                {requestedAt && (
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Requested:</span>
                    <span className="text-slate-300 font-medium">{requestedAt}</span>
                  </div>
                )}
              </div>
            )}

            {isUnauthorized && !accessRequestSent && (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded space-y-2 text-left">
                <span className="text-[11px] text-slate-300 font-semibold block">Need Access?</span>
                <p className="text-[10px] text-slate-400">
                  You can submit a formal access request directly to the workspace administrator.
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="email"
                    placeholder="Confirm your Google email"
                    value={attemptedEmail}
                    onChange={(e) => setAttemptedEmail(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleRequestAccess}
                    disabled={isRequesting || !attemptedEmail}
                    className="ent-btn-primary flex items-center space-x-1.5 text-xs py-1.5 px-3 whitespace-nowrap disabled:opacity-50"
                  >
                    {isRequesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Request</span>
                  </button>
                </div>
              </div>
            )}

            {accessRequestSent && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-300 text-xs flex items-center space-x-2 text-left">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Your access request has been sent to the organization administrator.</span>
              </div>
            )}

            <button
              onClick={() => navigate('/')}
              className="w-full ent-btn-secondary flex items-center justify-center space-x-2 text-xs py-2"
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
