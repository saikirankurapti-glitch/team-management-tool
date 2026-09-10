import crypto from 'crypto';

interface StateEntry {
  state: string;
  expiresAt: number;
  metadata?: any;
}

class OAuthStateManager {
  private states = new Map<string, StateEntry>();
  private TTL_MS = 10 * 60 * 1000; // 10 minutes TTL

  /**
   * Generate a cryptographically secure OAuth state token
   */
  generateState(metadata?: any): string {
    this.cleanupExpired();
    const state = crypto.randomBytes(32).toString('hex');
    this.states.set(state, {
      state,
      expiresAt: Date.now() + this.TTL_MS,
      metadata,
    });
    return state;
  }

  /**
   * Validate state token. Single-use: consumes state token upon validation.
   */
  validateState(state?: string): { valid: boolean; metadata?: any } {
    this.cleanupExpired();
    if (!state) return { valid: false };

    const entry = this.states.get(state);
    if (!entry) return { valid: false };

    if (Date.now() > entry.expiresAt) {
      this.states.delete(state);
      return { valid: false };
    }

    // Single-use token: remove state after validation to prevent replay attacks
    this.states.delete(state);
    return { valid: true, metadata: entry.metadata };
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.states.entries()) {
      if (now > entry.expiresAt) {
        this.states.delete(key);
      }
    }
  }
}

export const oauthStateManager = new OAuthStateManager();
