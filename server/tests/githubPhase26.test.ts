import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { fetchFromGitHubApi } from '../src/services/githubService';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345';

describe('Phase 26 — GitHub API 403 & Rate Limit Diagnostics Unit Tests', () => {
  beforeEach(async () => {
    await prisma.gitHubAppConfig.deleteMany();
    await prisma.gitHubConnection.deleteMany();
  });



  it('fetchFromGitHubApi attaches X-GitHub-Api-Version: 2022-11-28 and Accept headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({ login: 'testuser', id: 12345 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await fetchFromGitHubApi('/user', 'mock_token_123');

    expect(result.login).toBe('testuser');
    expect(fetchSpy).toHaveBeenCalled();

    const fetchArgs = fetchSpy.mock.calls[0];
    const headers = fetchArgs[1]?.headers as Record<string, string>;

    expect(headers['Authorization']).toBe('Bearer mock_token_123');
    expect(headers['Accept']).toBe('application/vnd.github+json');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');

    fetchSpy.mockRestore();
  });

  it('fetchFromGitHubApi detects rate limit remaining = 0 and throws rate limit error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-limit': '60',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
        },
      });
    });

    try {
      await fetchFromGitHubApi('/user', 'mock_token_123');
      expect.fail('Should have thrown rate limit error');
    } catch (err: any) {
      expect(err.isRateLimit).toBe(true);
      expect(err.message).toContain('GitHub API rate limit reached');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('GET /api/integrations/github/config returns CONFIGURED state when OAuth App exists without user token', async () => {
    process.env.GITHUB_CLIENT_ID = 'test_client_id';
    process.env.GITHUB_CLIENT_SECRET = 'test_client_secret';

    const testToken = jwt.sign(
      { id: 'admin-user-id', email: 'admin@example.com', role: 'ADMIN', organizationId: 'test-org-id' },
      JWT_SECRET
    );

    const res = await request(app)
      .get('/api/integrations/github/config')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.status).toBe('CONFIGURED');

    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
  });
});
