import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface TenantAuthRequest extends Request {
  correlationId?: string;
}

export const tenantContextMiddleware = (req: TenantAuthRequest, res: Response, next: NextFunction) => {
  // Inject Request Correlation ID for tracing
  const correlationId = (req.headers['x-correlation-id'] as string) || `req_${crypto.randomUUID()}`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  next();
};
