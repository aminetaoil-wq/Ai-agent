import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import * as service from './users.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { updateCraftsmanSchema, updateMeSchema } from './users.schemas';

export const usersRouter = Router();

usersRouter.patch(
  '/me',
  requireAuth,
  validate(updateMeSchema),
  asyncHandler(async (req, res) => {
    const user = await service.updateMe(req.user!.id, req.body);
    res.json({ user });
  }),
);

usersRouter.patch(
  '/me/craftsman',
  requireAuth,
  requireRole(Role.CRAFTSMAN),
  validate(updateCraftsmanSchema),
  asyncHandler(async (req, res) => {
    const profile = await service.updateCraftsmanProfile(req.user!.id, req.body);
    res.json({ profile });
  }),
);

const idParam = z.object({ id: z.string().min(1) });

usersRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const user = await service.getPublicProfile(req.params.id!);
    res.json({ user });
  }),
);

usersRouter.get(
  '/:id/reviews',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    // Reviews are returned within getPublicProfile; this dedicated endpoint
    // exists for paginated browsing later.
    const user = await service.getPublicProfile(req.params.id!);
    res.json({ reviews: user.reviewsReceived });
  }),
);
