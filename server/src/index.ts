import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { tenantContextMiddleware } from './middleware/tenantContext.js';
import { initSocketServer } from './socket/index.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(tenantContextMiddleware);

// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API routes
app.use('/api', router);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.get('/health/live', (_req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req, res) => {
  try {
    const { prisma } = await import('./prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'connected', timestamp: new Date() });
  } catch (err: any) {
    res.status(503).json({ status: 'unready', database: 'disconnected', error: err.message });
  }
});

app.get('/health/ready', async (_req, res) => {
  try {
    const { prisma } = await import('./prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'READY', database: 'CONNECTED', timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ status: 'NOT_READY', database: 'DISCONNECTED', error: err.message });
  }
});

app.get('/health/deps', async (_req, res) => {
  try {
    const { prisma } = await import('./prisma.js');
    const dbCheck = await prisma.$queryRaw`SELECT 1`.then(() => 'UP').catch(() => 'DOWN');
    res.json({
      status: 'HEALTHY',
      dependencies: { database: dbCheck, backgroundQueue: 'UP', socketServer: 'UP' },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Error handler
app.use(errorHandler);

// Socket.io initialization
initSocketServer(httpServer, CLIENT_ORIGIN);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`[Server] Startup Team Platform running on http://localhost:${PORT}`);
  });
}

export default app;
