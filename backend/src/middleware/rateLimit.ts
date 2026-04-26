import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

// Tiny in-memory token-bucket limiter. Good enough for one-instance MVP and
// a stop-gap against credential stuffing on /auth/login. Replace with a
// Redis-backed limiter (e.g. rate-limiter-flexible) when we scale out.
interface Bucket {
  count: number;
  resetAt: number;
}

interface Options {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
}

export const rateLimit = ({ windowMs, max, keyFn }: Options) => {
  const buckets = new Map<string, Bucket>();

  // Periodically prune cold buckets to avoid unbounded growth.
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn ? keyFn(req) : (req.ip ?? 'anon');
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= max) {
      const retry = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retry);
      return next(new AppError(429, 'too_many_requests', 'Too many requests, slow down.'));
    }
    bucket.count += 1;
    next();
  };
};
