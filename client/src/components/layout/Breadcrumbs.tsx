import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (location.pathname === '/' || location.pathname === '/landing' || location.pathname === '/login' || location.pathname === '/signup') {
    return null;
  }

  const formatSegment = (segment: string) => {
    return segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-ink-muted px-5 py-2 bg-canvas-secondary border-b border-borderWarm/80 shrink-0 select-none">
      <Link to="/" className="flex items-center hover:text-ink transition-colors font-medium">
        <Home className="w-3.5 h-3.5 mr-1.5 text-olive-dark" />
        <span>TMP</span>
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3.5 h-3.5 text-borderWarm shrink-0" />
            {isLast ? (
              <span className="font-bold text-ink truncate max-w-[200px]">
                {formatSegment(value)}
              </span>
            ) : (
              <Link to={to} className="hover:text-ink transition-colors truncate max-w-[150px] font-medium text-ink-secondary">
                {formatSegment(value)}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
