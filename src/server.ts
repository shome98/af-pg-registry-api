import express from 'express';
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

//  CORS
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? env.API_BASE_URL : '*',
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

//  Health Check
app.get('/health', (_req, res) => {
  sendSuccess(res, '💚 CRUD Factory Registry API is healthy!', {
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
