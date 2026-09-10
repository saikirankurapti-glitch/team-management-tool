import React, { useState } from 'react';
import { Settings, Shield, Building, User as UserIcon, CreditCard, Code2, Sparkles, Sliders, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { canAccessAdmin } from '../utils/rbac';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'profile' | 'organization' | 'security'>('profile');

  const isAdmin = canAccessAdmin(user?.role);

  const settingsNav = [
    { id: 'profile', label: 'User Profile', icon: UserIcon },
    { id: 'organization', label: 'Organization & Isolation', icon: Building },
    ...(isAdmin
      ? [
          { id: 'security', label: 'Security & Access', icon: Shield, link: '/settings/security' },
          { id: 'automations', label: 'Workflow Automations', icon: Sliders, link: '/automations' },
          { id: 'billing', label: 'Billing & Subscriptions', icon: CreditCard, link: '/settings/billing' },
          { id: 'ai', label: 'AI Configuration', icon: Sparkles, link: '/settings/ai' },
          { id: 'developer', label: 'Developer Apps', icon: Code2, link: '/settings/developer-apps' },
          { id: 'integrations', label: 'Integrations & Webhooks', icon: Sliders, link: '/integrations' },
          { id: 'ops', label: 'Ops Dashboard', icon: Activity, link: '/ops' },
        ]
      : []),
  ];

  return (
    <div className="flex h-full text-xs overflow-hidden">
      {/* Settings Sub-Navigation Sidebar */}
      <div className="w-56 bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-3 space-y-3 shrink-0">
        <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <Settings className="w-4 h-4 text-blue-500" />
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {isAdmin ? 'Administration' : 'Settings'}
          </span>
        </div>

        <nav className="space-y-0.5">
          {settingsNav.map((item) => {
            if (item.link) {
              return (
                <Link
                  key={item.id}
                  to={item.link}
                  className="flex items-center space-x-2 px-2.5 py-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
                >
                  <item.icon className="w-3.5 h-3.5 text-slate-500" />
                  <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-left transition-colors ${
                  activeSection === item.id
                    ? 'bg-blue-600/15 text-blue-400 font-semibold border-l-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Settings Configuration Panel */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Control Plane Configuration
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
            Manage enterprise workspace parameters, RBAC roles, and tenant parameters
          </p>
        </div>

        {activeSection === 'profile' && (
          <div className="ent-panel p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              User Profile Parameters
            </h2>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-2.5 ent-card">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Full Name</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.fullName}</span>
              </div>
              <div className="p-2.5 ent-card">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Email Address</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.email}</span>
              </div>
              <div className="p-2.5 ent-card">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Role</span>
                <span className="font-bold text-blue-500">{user?.role}</span>
              </div>
              <div className="p-2.5 ent-card">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Status</span>
                <span className="font-bold text-emerald-500">{user?.status}</span>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'organization' && (
          <div className="ent-panel p-4 space-y-2">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Tenant & Multi-Tenancy Architecture
            </h2>
            <p className="text-slate-300 leading-relaxed text-xs">
              All workspace assets, work items, chat channels, files, and telemetry are isolated under the active organization boundary. Multi-tenant RBAC policies enforce strict data boundaries across all API endpoints.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
