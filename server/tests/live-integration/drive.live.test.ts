import { describe, it, expect } from 'vitest';
import { isGoogleDriveConfigured } from '../../src/services/googleDriveService.js';

describe('Live Integration - Google Drive Storage Provider', () => {
  const isLive = process.env.LIVE_INTEGRATION_TESTS === 'true';

  it.runIf(isLive)('Reports Google Drive Configuration status cleanly', () => {
    const configured = isGoogleDriveConfigured();
    if (!process.env.GOOGLE_CLIENT_ID) {
      expect(configured).toBe(false);
    }
  });
});
