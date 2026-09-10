import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CheckSquare, FolderKanban, MessageSquare, Bell, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenDrawer: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenDrawer }) => {
  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/my-work', label: 'My Work', icon: CheckSquare },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/chat', label: 'Chat', icon: MessageSquare },
    { to: '/notifications', label: 'Alerts', icon: Bell },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-borderWarm z-40 px-2 py-1.5 flex items-center justify-around font-sans">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center py-1 px-2.5 rounded-xl transition ${
                isActive ? 'text-olive font-extrabold' : 'text-ink/60 hover:text-ink'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
          </NavLink>
        );
      })}

      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center py-1 px-2.5 text-ink/60 hover:text-ink rounded-xl transition"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 font-medium">Menu</span>
      </button>
    </div>
  );
};
