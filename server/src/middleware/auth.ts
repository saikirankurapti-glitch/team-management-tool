import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    organizationId: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345';

import { prisma } from '../prisma.js';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Verify user exists and is active in database
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, fullName: true, role: true, organizationId: true, isActive: true },
    });

    if (!dbUser || !dbUser.isActive) {
      return res.status(403).json({
        code: 'USER_DEACTIVATED',
        message: 'Your user account is inactive or has been deactivated. Access denied.',
      });
    }

    req.user = dbUser;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// RBAC Role Hierarchy Weights
const ROLE_WEIGHTS: Record<string, number> = {
  OWNER: 50,
  ADMIN: 40,
  PROJECT_MANAGER: 30,
  TEAM_MEMBER: 20,
  VIEWER: 10,
};

export const requireRole = (minRole: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userWeight = ROLE_WEIGHTS[req.user.role] || 0;
    const requiredWeight = ROLE_WEIGHTS[minRole] || 0;

    if (userWeight < requiredWeight) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};
