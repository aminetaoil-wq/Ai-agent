import { Router } from 'express';
import { Role } from '@prisma/client';
import * as service from './jobs.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { param } from '../../utils/params';
import {
  createJobSchema,
  idParamSchema,
  listJobsQuerySchema,
  updateJobSchema,
} from './jobs.schemas';
import { messagesRouter } from '../messages/messages.routes';
import { reviewsRouter } from '../reviews/reviews.routes';

export const jobsRouter = Router();

// All endpoints below require auth.
jobsRouter.use(requireAuth);

jobsRouter.post(
  '/',
  requireRole(Role.CLIENT),
  validate(createJobSchema),
  asyncHandler(async (req, res) => {
    const job = await service.createJob(req.user!.id, req.body);
    res.status(201).json({ job });
  }),
);

jobsRouter.get(
  '/',
  requireRole(Role.CRAFTSMAN),
  validate(listJobsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listOpenJobs(req.query as never);
    res.json(result);
  }),
);

// `/me` is intentionally registered before `/:id` so it doesn't get matched
// as an id.
jobsRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const jobs = await service.listMyJobs(req.user!.id, req.user!.role);
    res.json({ jobs });
  }),
);

jobsRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.getJob(param(req, 'id'), req.user!.id, req.user!.role);
    res.json({ job });
  }),
);

jobsRouter.patch(
  '/:id',
  requireRole(Role.CLIENT),
  validate(idParamSchema, 'params'),
  validate(updateJobSchema),
  asyncHandler(async (req, res) => {
    const job = await service.updateJob(req.user!.id, param(req, 'id'), req.body);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/accept',
  requireRole(Role.CRAFTSMAN),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.acceptJob(param(req, 'id'), req.user!.id);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/start',
  requireRole(Role.CRAFTSMAN),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.startJob(param(req, 'id'), req.user!.id);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/complete',
  requireRole(Role.CRAFTSMAN),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.completeJob(param(req, 'id'), req.user!.id);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/cancel',
  requireRole(Role.CLIENT),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.cancelJob(param(req, 'id'), req.user!.id);
    res.json({ job });
  }),
);

// Sub-resources mounted as nested routers (URLs unchanged).
jobsRouter.use('/:id/messages', validate(idParamSchema, 'params'), messagesRouter);
jobsRouter.use('/:id/reviews', validate(idParamSchema, 'params'), reviewsRouter);
