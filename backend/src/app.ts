import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { requestId } from './middleware/requestId';
import { rateLimit } from './middleware/rateLimit';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { jobsRouter } from './modules/jobs/jobs.routes';

export const createApp = (): Application => {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()), credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Auth surface is the cheapest target for credential stuffing — limit it.
  // 20 attempts per 15 minutes per IP is a generous human cap, hostile to bots.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
  app.use('/api/auth', authLimiter, authRouter);

  app.use('/api/users', usersRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/jobs', jobsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
