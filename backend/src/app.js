import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import apiRoutes from './routes/index.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

/**
 * Construct and configure the Express application (without starting it).
 * Kept separate from server bootstrap for testability.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers with a CSP tuned for the self-hosted single-page frontend.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  const corsOrigins = config.security.corsOrigins;
  app.use(
    cors({
      origin: corsOrigins.includes('*') ? true : corsOrigins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  // API surface (rate-limited).
  app.use('/api', globalLimiter, apiRoutes);

  // Static frontend.
  app.use(express.static(config.paths.frontend, { extensions: ['html'] }));

  // API 404s return JSON; everything else falls back to the SPA shell.
  app.use('/api', notFoundHandler);
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    return res.sendFile('index.html', { root: config.paths.frontend });
  });

  app.use(errorHandler);
  return app;
}
