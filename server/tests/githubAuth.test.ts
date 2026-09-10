import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { oauthStateManager } from '../src/services/oauthStateManager';

describe('GitHub OAuth Authentication Flow Unit Tests', () => {
  beforeEach(async () => {
    // Clear DB configs before test
    await prisma.gitHubAppConfig.deleteMany();
    await prisma.gitHubConnection.deleteMany();
  });



  it('GET /api/auth/github/url returns error when GITHUB_CLIENT_ID is unconfigured', async () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    const res = await request(app).get('/api/auth/github/url');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('GITHUB_NOT_CONFIGURED');
    expect(res.body.error.message).toContain('GitHub sign-in is temporarily unavailable');
  });

  it('GET /api/auth/github/url returns real authorization URL when configured', async () => {
    process.env.GITHUB_CLIENT_ID = 'test_github_client_id_123';
    process.env.GITHUB_CLIENT_SECRET = 'test_github_client_secret_123';
    process.env.GITHUB_CALLBACK_URL = 'http://localhost:5173/auth/github/callback';

    const res = await request(app).get('/api/auth/github/url');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toContain('https://github.com/login/oauth/authorize');
    expect(res.body.url).toContain('client_id=test_github_client_id_123');
    expect(res.body.state).toBeDefined();

    // Clean up env
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
  });

  it('POST /api/auth/github/callback requires authorization code and valid state', async () => {
    process.env.GITHUB_CLIENT_ID = 'test_id';
    process.env.GITHUB_CLIENT_SECRET = 'test_secret';

    // 1. Missing state returns INVALID_STATE
    const noStateRes = await request(app)
      .post('/api/auth/github/callback')
      .send({});

    expect(noStateRes.status).toBe(400);
    expect(noStateRes.body.success).toBe(false);
    expect(noStateRes.body.error.code).toBe('INVALID_STATE');

    // 2. Valid state but missing authorization code returns INVALID_CODE
    const validState = oauthStateManager.generateState();
    const noCodeRes = await request(app)
      .post('/api/auth/github/callback')
      .send({ state: validState });

    expect(noCodeRes.status).toBe(400);
    expect(noCodeRes.body.success).toBe(false);
    expect(noCodeRes.body.error.code).toBe('INVALID_CODE');

    // Clean up env
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
  });
});
