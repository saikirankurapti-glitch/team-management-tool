import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { encryptToken, decryptToken, generateGoogleAuthUrl, GOOGLE_SCOPES } from '../src/services/googleAuthService.js';

describe('Google OAuth 2.0 Integration Unit Tests', () => {
  beforeEach(async () => {
    await prisma.googleAppConfig.deleteMany();
    await prisma.googleConnection.deleteMany();
  });

  it('verifies AES-256-CBC token encryption and decryption', () => {
    const rawToken = 'ya29.a0Axoo-google-access-token-sample-12345';
    const encrypted = encryptToken(rawToken);
    expect(encrypted).not.toBe(rawToken);
    expect(encrypted).toContain(':');

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('GET /api/auth/google/url returns error when unconfigured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const res = await request(app).get('/api/auth/google/url');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
  });

  it('generateGoogleAuthUrl builds correct authorization URL with required scopes', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test_google_client_id_123.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret_456';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5173/auth/google/callback';

    const url = await generateGoogleAuthUrl();

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=test_google_client_id_123.apps.googleusercontent.com');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain('response_type=code');

    for (const scope of GOOGLE_SCOPES) {
      expect(url).toContain(encodeURIComponent(scope));
    }

    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });
});
