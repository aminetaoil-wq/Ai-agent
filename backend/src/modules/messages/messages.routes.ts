import { Router } from 'express';
import * as service from './messages.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { param } from '../../utils/params';
import { sendMessageSchema } from './messages.schemas';

// Mounted at /api/jobs/:id/messages — `mergeParams` exposes :id.
export const messagesRouter = Router({ mergeParams: true });

messagesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const messages = await service.listMessages(param(req, 'id'), req.user!.id);
    res.json({ messages });
  }),
);

messagesRouter.post(
  '/',
  validate(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const message = await service.sendMessage(
      param(req, 'id'),
      req.user!.id,
      req.body.content,
    );
    res.status(201).json({ message });
  }),
);
