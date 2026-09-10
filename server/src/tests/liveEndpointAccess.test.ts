import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345';
const BASE_URL = 'http://localhost:5000/api';

describe('End-to-End Live Endpoint Access Control', () => {
  const tokenSai = jwt.sign(
    {
      id: '467a2534-a1a3-44f7-9dad-798582eabbab',
      email: 'kiran@demostartup.com',
      fullName: 'Sai Kiran',
      role: 'ADMIN',
      organizationId: '1a317fa2-a359-406b-a254-abaeabe68b46',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenAshwin = jwt.sign(
    {
      id: 'b358314c-9ed7-4fa2-b3f8-8d7b69e81053',
      email: 'sai@demostartup.com',
      fullName: 'Ashwin T',
      role: 'PROJECT_MANAGER',
      organizationId: '1a317fa2-a359-406b-a254-abaeabe68b46',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const token04 = jwt.sign(
    {
      id: '99da7ca2-b1b4-4f4f-9f9f-2f7f0cacabe9',
      email: 'saikirankurapati04@gmail.com',
      fullName: 'Google User 04',
      role: 'TEAM_MEMBER',
      organizationId: '1a317fa2-a359-406b-a254-abaeabe68b46',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  it('verifies Sai Kiran (ADMIN) can access Admin endpoints', async () => {
    const res = await fetch(`${BASE_URL}/security/allowlist`, {
      headers: { Authorization: `Bearer ${tokenSai}` },
    });
    expect(res.status).toBe(200);
  });

  it('verifies Sai Kiran (ADMIN) can access Commercial Pricing', async () => {
    const res = await fetch(`${BASE_URL}/projects/PROJ/pricing`, {
      headers: { Authorization: `Bearer ${tokenSai}` },
    });
    // Either 200 or 404 (if project not found), but NEVER 403
    expect(res.status).not.toBe(403);
  });

  it('verifies Sai Kiran (ADMIN) can access Price Allocation', async () => {
    const res = await fetch(`${BASE_URL}/projects/PROJ/price-allocation`, {
      headers: { Authorization: `Bearer ${tokenSai}` },
    });
    expect(res.status).not.toBe(403);
  });

  it('verifies Ashwin T (CTO/Manager) receives 403 on Admin Security Allowlist', async () => {
    const res = await fetch(`${BASE_URL}/security/allowlist`, {
      headers: { Authorization: `Bearer ${tokenAshwin}` },
    });
    expect(res.status).toBe(403);
  });

  it('verifies Ashwin T (CTO/Manager) receives 403 on Commercial Pricing', async () => {
    const res = await fetch(`${BASE_URL}/projects/PROJ/pricing`, {
      headers: { Authorization: `Bearer ${tokenAshwin}` },
    });
    expect(res.status).toBe(403);
  });

  it('verifies Ashwin T (CTO/Manager) CAN access Price Allocation', async () => {
    const res = await fetch(`${BASE_URL}/projects/PROJ/price-allocation`, {
      headers: { Authorization: `Bearer ${tokenAshwin}` },
    });
    expect(res.status).not.toBe(403);
  });

  it('verifies saikirankurapati04@gmail.com (TEAM_MEMBER) receives 403 on Admin endpoints', async () => {
    const res = await fetch(`${BASE_URL}/security/allowlist`, {
      headers: { Authorization: `Bearer ${token04}` },
    });
    expect(res.status).toBe(403);
  });

  it('verifies saikirankurapati04@gmail.com (TEAM_MEMBER) receives 403 on Commercial Pricing', async () => {
    const res = await fetch(`${BASE_URL}/projects/PROJ/pricing`, {
      headers: { Authorization: `Bearer ${token04}` },
    });
    expect(res.status).toBe(403);
  });

  it('verifies saikirankurapati04@gmail.com (TEAM_MEMBER) receives 403 on Price Allocation', async () => {
    const res = await fetch(`${BASE_URL}/projects/PROJ/price-allocation`, {
      headers: { Authorization: `Bearer ${token04}` },
    });
    expect(res.status).toBe(403);
  });
});
