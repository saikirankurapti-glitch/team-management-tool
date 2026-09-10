export interface SystemMetrics {
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  activeSockets: number;
  activeJobsPending: number;
  activeJobsFailed: number;
  aiCircuitState: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
  uptimeSeconds: number;
}

class MetricsRegistryService {
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private totalLatency: number = 0;
  private socketCount: number = 0;

  public recordRequest(latencyMs: number, isError: boolean = false) {
    this.requestCount++;
    this.totalLatency += latencyMs;
    if (isError) this.errorCount++;
  }

  public setSocketCount(count: number) {
    this.socketCount = count;
  }

  public getMetrics(): SystemMetrics {
    const avgLatency = this.requestCount > 0 ? Math.round(this.totalLatency / this.requestCount) : 0;
    return {
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      avgLatencyMs: avgLatency,
      activeSockets: this.socketCount,
      activeJobsPending: 0,
      activeJobsFailed: 0,
      aiCircuitState: 'CLOSED',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

export const MetricsRegistry = new MetricsRegistryService();
