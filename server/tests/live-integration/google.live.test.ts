import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';

describe('Live Integration - Google OAuth Authentication', () => {
  const isLive = process.env.LIVE_INTEGRATION_TESTS === 'true';

  it.runIf(isLive)('Validates Google OAuth URL endpoint', async () => {
    const res = await request(app).get('/api/auth/google/url');
    if (process.env.GOOGLE_CLIENT_ID) {
      expect(res.status).toBe(200);
      expect(res.body.url).toContain('accounts.google.com');
    } else {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
    }
  });
});
