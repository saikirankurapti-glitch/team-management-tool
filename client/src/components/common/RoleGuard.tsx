import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasMinRole, UserRole } from '../../utils/rbac';

interface RoleGuardProps {
  minRole: UserRole;
  children: React.ReactElement;
  redirectTo?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  minRole,
  children,
  redirectTo = '/',
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user || !hasMinRole(user.role, minRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};
