import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, Zap, Users, AlertCircle, FlaskConical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// DEV_MODE is a compile-time constant injected by Vite.
// import.meta.env.DEV is TRUE only when running `npm run dev` (NODE_ENV=development).
// In a production build (`npm run build`), this evaluates to FALSE and the entire
// Development Login section is tree-shaken out — it does NOT exist in production.
const IS_DEV = import.meta.env.DEV;

// LOCAL DEVELOPMENT TEST CREDENTIALS — never use in production
const DEV_EMAIL = 'test@tmp.local';
const DEV_PASSWORD = 'TmpTest@12345';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();

  // Primary login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGitHubRedirecting, setIsGitHubRedirecting] = useState(false);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);

  // Development-only login state
  const [devError, setDevError] = useState('');
  const [isDevSubmitting, setIsDevSubmitting] = useState(false);

  const handleGitHubLogin = async () => {
    setError('');
    setIsGitHubRedirecting(true);

    try {
      const res = await fetch('/api/auth/github/url');
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error?.message || 'GitHub sign-in is temporarily unavailable. Please contact your administrator.');
        setIsGitHubRedirecting(false);
      }
    } catch (err: any) {
      setError(err.message || 'GitHub sign-in is temporarily unavailable. Please contact your administrator.');
      setIsGitHubRedirecting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleRedirecting(true);

    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error?.message || 'Google sign-in is temporarily unavailable. Please contact your administrator.');
        setIsGoogleRedirecting(false);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-in is temporarily unavailable. Please contact your administrator.');
      setIsGoogleRedirecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Development-only sign-in handler.
   * Uses the standard AuthContext login() which calls /api/auth/login —
   * the dev user is a real DB user with a properly hashed password.
   * This function only executes from UI code that is gated on IS_DEV,
   * so it will never be callable in a production build.
   */
  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevError('');
    setIsDevSubmitting(true);
    try {
      await login(DEV_EMAIL, DEV_PASSWORD);
    } catch (err: any) {
      setDevError(err.message || 'Development login failed. Have you run the seed script?');
    } finally {
      setIsDevSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6 select-none font-sans">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

        {/* Left Editorial Branding */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-olive flex items-center justify-center text-white font-black shadow-sm">
              <span className="text-base font-black tracking-tight">TMP</span>
            </div>
            <div>
              <div className="editorial-eyebrow text-[9px] mb-0.5">[ OPERATING SYSTEM ]</div>
              <h1 className="text-xl font-black text-ink tracking-tight">TMP Enterprise</h1>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="editorial-headline text-3xl md:text-4xl font-black text-ink leading-tight">
              Run your team with clarity.
            </h2>
            <p className="text-xs text-ink/70 leading-relaxed max-w-md font-sans">
              The modern operating system for engineering organizations. Backlog prioritization, Kanban telemetry, and private team governance.
            </p>
          </div>

          <div className="space-y-3 pt-2 font-mono text-xs text-ink/80">
            <div className="flex items-center space-x-2.5">
              <ShieldCheck className="w-4 h-4 text-olive" />
              <span>Multi-Tenant &amp; Role-Based Access Isolation</span>
            </div>
            <div className="flex items-center space-x-2.5">
              <Zap className="w-4 h-4 text-olive" />
              <span>Real-Time GitHub &amp; DevOps Telemetry Sync</span>
            </div>
            <div className="flex items-center space-x-2.5">
              <Users className="w-4 h-4 text-olive" />
              <span>Workforce Telemetry &amp; Capacity Allocation</span>
            </div>
          </div>
        </div>

        {/* Right Form Card */}
        <div className="panel-cream p-8 space-y-6 shadow-xl border border-borderWarm">
          <div className="text-center md:text-left space-y-1">
            <div className="editorial-eyebrow mb-1">[ AUTHENTICATION ]</div>
            <h2 className="text-2xl font-black text-ink tracking-tight">Sign In</h2>
            <p className="text-xs text-ink/65">Authorized private team workspace access</p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-700 dark:text-rose-400 text-xs flex items-start space-x-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Social OAuth Buttons */}
          <div className="space-y-3">
            {/* Continue with GitHub */}
            <button
              id="github-login-btn"
              type="button"
              onClick={handleGitHubLogin}
              disabled={isGitHubRedirecting || isGoogleRedirecting}
              className="w-full flex items-center justify-center space-x-2.5 py-3 px-4 bg-surface hover:bg-canvas border border-borderWarm text-ink font-bold text-xs rounded-full transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4 fill-current text-ink" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>{isGitHubRedirecting ? 'Redirecting to GitHub...' : 'Continue with GitHub'}</span>
            </button>

            {/* Continue with Google */}
            <button
              id="google-login-btn"
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGitHubRedirecting || isGoogleRedirecting}
              className="w-full flex items-center justify-center space-x-2.5 py-3 px-4 bg-surface hover:bg-canvas border border-borderWarm text-ink font-bold text-xs rounded-full transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isGoogleRedirecting ? 'Redirecting to Google...' : 'Continue with Google'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between my-4">
            <span className="w-full border-t border-borderWarm" />
            <span className="px-3 text-[10px] text-ink/40 uppercase font-mono tracking-widest shrink-0">OR</span>
            <span className="w-full border-t border-borderWarm" />
          </div>

          {/* Standard Email + Password Form */}
          <form id="password-login-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="editorial-eyebrow text-[9px] block mb-1">Email Address</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                className="input-warm w-full text-xs font-medium py-2.5 px-3.5 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="editorial-eyebrow text-[9px] block mb-1">Password</label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-warm w-full text-xs font-medium py-2.5 px-3.5 rounded-xl"
              />
            </div>

            <button
              id="password-login-submit"
              type="submit"
              disabled={isSubmitting}
              className="btn-pill-primary w-full flex items-center justify-center space-x-1.5 py-3 shadow-md active:scale-[0.99] text-xs"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In with Password'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* ── DEVELOPMENT-ONLY: Development Login Section ─────────────────────────
               Gated on import.meta.env.DEV (Vite compile-time constant).
               • In development (npm run dev): IS_DEV = true → section renders.
               • In production (npm run build): IS_DEV = false → section is
                 tree-shaken out entirely. It does NOT exist in the production bundle.
               This section uses the SAME /api/auth/login route as the main form —
               no special backend route is needed.
          ─────────────────────────────────────────────────────────────────────── */}
          {IS_DEV && (
            <div
              id="dev-login-section"
              className="mt-2 rounded-2xl border-2 border-dashed border-amber-400/60 bg-amber-50/60 dark:bg-amber-900/10 p-4 space-y-3"
              role="region"
              aria-label="Development Login Section"
            >
              {/* Header */}
              <div className="flex items-center space-x-2">
                <FlaskConical className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div className="text-[9px] font-mono font-bold tracking-widest text-amber-600 uppercase">
                    [ DEV ONLY ]
                  </div>
                  <div className="text-xs font-black text-amber-800 dark:text-amber-300 tracking-tight">
                    Development Login
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-mono leading-relaxed">
                Local development test account — bypasses Google/GitHub OAuth.{' '}
                <span className="font-bold">Never available in production.</span>
              </p>

              {devError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 text-[10px] flex items-start space-x-2 font-mono">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                  <span>{devError}</span>
                </div>
              )}

              {/* Dev credentials form — read-only fields for visibility */}
              <form id="dev-login-form" onSubmit={handleDevLogin} className="space-y-2.5">
                <div>
                  <label
                    htmlFor="dev-email"
                    className="text-[9px] font-mono font-bold tracking-widest text-amber-700 uppercase block mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="dev-email"
                    type="email"
                    readOnly
                    value={DEV_EMAIL}
                    className="w-full text-[11px] font-mono bg-amber-100/70 dark:bg-amber-900/30 border border-amber-300/60 rounded-lg px-3 py-2 text-amber-900 dark:text-amber-200 cursor-default select-all"
                    aria-label="Development test email address"
                  />
                </div>

                <div>
                  <label
                    htmlFor="dev-password"
                    className="text-[9px] font-mono font-bold tracking-widest text-amber-700 uppercase block mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="dev-password"
                    type="text"
                    readOnly
                    value={DEV_PASSWORD}
                    className="w-full text-[11px] font-mono bg-amber-100/70 dark:bg-amber-900/30 border border-amber-300/60 rounded-lg px-3 py-2 text-amber-900 dark:text-amber-200 cursor-default select-all"
                    aria-label="Development test password"
                  />
                </div>

                <button
                  id="dev-login-btn"
                  type="submit"
                  disabled={isDevSubmitting}
                  className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all shadow-sm active:scale-[0.98]"
                  aria-label="Sign in with development test account"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>{isDevSubmitting ? 'Signing in...' : 'Sign In (Dev)'}</span>
                </button>
              </form>

              <p className="text-[9px] font-mono text-amber-600/60 text-center">
                LOCAL DEVELOPMENT TEST CREDENTIALS · DO NOT USE IN PRODUCTION
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
