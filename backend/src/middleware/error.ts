import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'conflict', message: 'Resource already exists' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'not_found', message: 'Resource not found' });
      return;
    }
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'internal_error', message: 'Something went wrong' });
};

export const notFoundHandler = (_req: import('express').Request, res: import('express').Response) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found' });
};
