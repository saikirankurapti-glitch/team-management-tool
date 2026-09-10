class AiCircuitBreakerService {
  private failureCount: number = 0;
  private maxFailures: number = 5;
  private state: 'CLOSED' | 'HALF_OPEN' | 'OPEN' = 'CLOSED';
  private lastStateChange: number = Date.now();
  private resetTimeoutMs: number = 30000; // 30 seconds recovery window

  public async execute<T>(aiTaskFn: () => Promise<T>, fallbackFn: () => T): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastStateChange > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        return fallbackFn();
      }
    }

    try {
      const result = await aiTaskFn();
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= this.maxFailures) {
        this.state = 'OPEN';
        this.lastStateChange = Date.now();
      }
      return fallbackFn();
    }
  }

  public reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastStateChange = Date.now();
  }

  public getState() {
    return this.state;
  }
}

export const AiCircuitBreaker = new AiCircuitBreakerService();
