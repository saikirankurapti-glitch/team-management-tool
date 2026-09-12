/**
 * devAuthController.ts
 *
 * DEVELOPMENT-ONLY authentication controller for the TMP platform.
 *
 * This controller provides a password-based login endpoint that only works
 * when NODE_ENV=development. It is designed for local development testing
 * on machines that have not yet configured Google/GitHub OAuth credentials.
 *
 * SECURITY REQUIREMENTS:
 *  - This handler MUST return 403 in any non-development environment.
 *  - It uses the exact same bcrypt + JWT mechanism as the production login().
 *  - It NEVER bypasses RBAC, organization isolation, or any auth middleware.
 *  - The route that calls this handler is conditionally registered ONLY in
 *    development (see routes/index.ts), providing defence-in-depth.
 *
 * DO NOT:
 *  - Remove the NODE_ENV guard.
 *  - Call this from a production-facing route.
 *  - Store or log plaintext passwords.
 */

import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const JWT_SECRET =
  process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345';

/**
 * POST /api/auth/dev-login
 *
 * Development-only password login. Returns a standard JWT identical in shape
 * to the one issued by the production login() handler so all downstream
 * middleware and the frontend work without any special-casing.
 *
 * Disabled (403) unless NODE_ENV === 'development'.
 */
export const devLogin = async (req: AuthRequest, res: Response) => {
  // ── Production guard ─────────────────────────────────────────────────────
  // This MUST be the first check. If this server is running in any environment
  // other than 'development', reject the request unconditionally.
  if (process.env.NODE_ENV !== 'development') {
    console.warn('[DEV_AUTH] Rejected dev-login attempt: NODE_ENV is not development.');
    return res.status(403).json({
      message: 'Development login is not available in production.',
      code: 'DEV_LOGIN_DISABLED',
    });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Look up user using the same Prisma query as the production login handler
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { organization: true },
    });

    if (!user) {
      // Timing-safe: still call bcrypt even on missing user to avoid
      // enumeration attacks (consistent response time).
      await bcrypt.compare(password, '$2a$10$invalidhashpadding000000000000000000000000000000000');
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Verify password with bcrypt — same implementation as production login()
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Set user online (same as production login)
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ONLINE' },
    });

    // Sign a standard JWT — identical shape to production login()
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log the successful dev login (never log the password)
    console.log(
      `[DEV_AUTH] Development login succeeded for email=${user.email} role=${user.role} userId=${user.id}`
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: 'ONLINE',
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
    });
  } catch (error: any) {
    console.error('[DEV_AUTH] Error during dev login:', error.message);
    return res.status(500).json({ message: error.message || 'Dev login failed.' });
  }
};
