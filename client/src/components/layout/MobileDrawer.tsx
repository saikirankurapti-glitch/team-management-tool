import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, BookOpen, Calendar, BarChart3, Layers, Settings, Sparkles, Shield, Key } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { canAccessAdmin } from '../../utils/rbac';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  if (!isOpen) return null;

  const isAdmin = canAccessAdmin(user?.role);

  const links = [
    { to: '/knowledge', label: 'Knowledge Hub', icon: BookOpen },
    { to: '/templates', label: 'Project Templates', icon: Layers },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
    { to: '/analytics', label: 'Analytics & Portfolio', icon: BarChart3 },
    ...(isAdmin
      ? [
          { to: '/settings/security', label: 'Security Center', icon: Shield },
          { to: '/settings/developer-apps', label: 'Developer Apps', icon: Key },
        ]
      : []),
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-out Menu Panel */}
      <div className="relative w-4/5 max-w-xs bg-surface border-r border-borderWarm h-full p-6 space-y-6 flex flex-col justify-between z-10 font-sans text-xs">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-olive flex items-center justify-center font-black text-white text-xs shadow-xs">
                TMP
              </div>
              <div>
                <span className="font-black text-sm text-ink">TMP</span>
                <span className="editorial-eyebrow text-[9px] block text-ink/60 -mt-0.5">[ WORKSPACE ]</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-ink/60 hover:text-ink">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3.5 py-2.5 rounded-full font-bold transition ${
                      isActive ? 'bg-olive text-white shadow-xs' : 'text-ink/75 hover:bg-canvas hover:text-ink'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-canvas rounded-2xl border border-borderWarm text-[10px] text-ink/65 space-y-1">
          <div className="font-bold text-ink">PWA & Offline Ready</div>
          <div>All mutations sync automatically upon network recovery.</div>
        </div>
      </div>
    </div>
  );
};
