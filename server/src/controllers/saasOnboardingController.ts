import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const publicSignupAndOnboard = async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, email, password, organizationName, projectTemplate } = req.body;

    if (!fullName || !email || !password || !organizationName) {
      return res.status(400).json({ message: 'Full name, email, password, and organization name are required.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const slug = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();

    // Create Organization
    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug,
      },
    });

    // Initialize 14-day trial subscription
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        organizationId: organization.id,
        plan: 'TEAM',
        status: 'TRIALING',
        trialEndsAt: trialEnds,
        maxMembers: 25,
        maxProjects: 20,
      },
    });

    // Create Owner User
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        fullName,
        email,
        passwordHash,
        role: 'OWNER',
        status: 'ONLINE',
      },
    });

    // Create Initial Project based on Template
    const projectKey = organizationName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4) || 'PROJ';
    const project = await prisma.project.create({
      data: {
        organizationId: organization.id,
        key: projectKey,
        name: `${organizationName} First Project`,
        ownerId: user.id,
        health: 'HEALTHY',
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, fullName: user.fullName, organizationId: organization.id, role: user.role },
      process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345',
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        organizationId: organization.id,
      },
      organization,
      project,
    });
  } catch (error: any) {
    console.error('[PublicSignup Error]:', error);
    return res.status(500).json({ message: error.message });
  }
};
