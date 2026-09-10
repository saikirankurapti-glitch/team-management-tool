import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { fetchApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await fetchApi<any>('/auth/public-signup', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          organizationName,
        }),
      });

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-xs text-slate-100 font-sans">
      <div className="ent-panel w-full max-w-md p-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex p-2 bg-blue-600/10 text-blue-400 rounded mb-1">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-100 uppercase">Create Workspace Tenant</h1>
          <p className="text-slate-500 text-[11px]">Set up your organization engineering workstation</p>
        </div>

        {error && <div className="p-2.5 badge-red rounded text-center">{error}</div>}

        <form onSubmit={handleSignup} className="space-y-3">
          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="ent-input w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@company.com"
              className="ent-input w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="ent-input w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Organization Name</label>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g. Acme Engineering"
              className="ent-input w-full"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="ent-btn-primary w-full flex items-center justify-center space-x-1"
          >
            <span>Create Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-center text-slate-500 text-[11px] pt-1">
          Already registered? <Link to="/login" className="text-blue-400 hover:underline font-bold">Sign In</Link>
        </div>
      </div>
    </div>
  );
};
