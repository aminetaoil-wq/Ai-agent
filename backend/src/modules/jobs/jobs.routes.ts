import { Router } from 'express';
import { Role } from '@prisma/client';
import * as service from './jobs.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  createJobSchema,
  createReviewSchema,
  idParamSchema,
  listJobsQuerySchema,
  sendMessageSchema,
  updateJobSchema,
} from './jobs.schemas';

export const jobsRouter = Router();

// All endpoints require auth.
jobsRouter.use(requireAuth);

// CLIENT: post a new job.
jobsRouter.post(
  '/',
  requireRole(Role.CLIENT),
  validate(createJobSchema),
  asyncHandler(async (req, res) => {
    const job = await service.createJob(req.user!.id, req.body);
    res.status(201).json({ job });
  }),
);

// CRAFTSMAN: open feed.
jobsRouter.get(
  '/',
  requireRole(Role.CRAFTSMAN),
  validate(listJobsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listOpenJobs(req.query as never);
    res.json(result);
  }),
);

// USER: my jobs (semantics depend on role).
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
    const job = await service.getJob(req.params.id!, req.user!.id, req.user!.role);
    res.json({ job });
  }),
);

jobsRouter.patch(
  '/:id',
  requireRole(Role.CLIENT),
  validate(idParamSchema, 'params'),
  validate(updateJobSchema),
  asyncHandler(async (req, res) => {
    const job = await service.updateJob(req.user!.id, req.params.id!, req.body);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/accept',
  requireRole(Role.CRAFTSMAN),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.acceptJob(req.params.id!, req.user!.id);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/start',
  requireRole(Role.CRAFTSMAN),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.startJob(req.params.id!, req.user!.id);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/complete',
  requireRole(Role.CRAFTSMAN),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.completeJob(req.params.id!, req.user!.id);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/cancel',
  requireRole(Role.CLIENT),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.cancelJob(req.params.id!, req.user!.id);
    res.json({ job });
  }),
);

// Messages live under the job (chat thread is scoped to a job).
jobsRouter.get(
  '/:id/messages',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const messages = await service.listMessages(req.params.id!, req.user!.id);
    res.json({ messages });
  }),
);

jobsRouter.post(
  '/:id/messages',
  validate(idParamSchema, 'params'),
  validate(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const message = await service.sendMessage(req.params.id!, req.user!.id, req.body.content);
    res.status(201).json({ message });
  }),
);

// Reviews are also nested under jobs.
jobsRouter.post(
  '/:id/reviews',
  validate(idParamSchema, 'params'),
  validate(createReviewSchema),
  asyncHandler(async (req, res) => {
    const review = await service.createReview(
      req.params.id!,
      req.user!.id,
      req.body.rating,
      req.body.comment,
    );
    res.status(201).json({ review });
  }),
);
