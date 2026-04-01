import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { API_PREFIX } from './config/constants';
import { globalRateLimiter } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';
import mongoApiRoutes from './routes/mongo-api.routes';
import { sendSuccess, sendError } from './utils/api-response';
import { env } from './config/env';
import cookieParser from 'cookie-parser';
import logger from './utils/logger';

const app = express();

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        userId: (req as any).auth?.userId,
        apiId: (req as any).params?.apiId,
      },
    );
  });
  next();
});
//  Security Headers
app.use(helmet());

const allowedOrigins = env.FRONTEND_URL
  ? [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001']
  : ['http://localhost:3000', 'http://localhost:3001'];

//  CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

//  Body Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
//  Global Rate Limiter
app.use(globalRateLimiter);

app.get('/', (req: Request, res: Response) => {
  sendSuccess(res, '😊 Welcome start registering!', {
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});
//  Health Check
app.get('/healthz', (_req, res) => {
  sendSuccess(res, '💚 Registry API is healthy!', {
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});
//  Ready Check
app.get('/readyz', (_req, res) => {
  sendSuccess(res, '🚀 Registry API is ready!', {
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

//  API Routes
app.use(`${API_PREFIX}/mongo-apis`, mongoApiRoutes);

//  404 Handler
app.use((req, res) => {
  sendError(res, `🔍 Route ${req.method} ${req.originalUrl} not found.`, 404);
});

//  Global Error Handler (must be LAST)
app.use(errorHandler);

export default app;
