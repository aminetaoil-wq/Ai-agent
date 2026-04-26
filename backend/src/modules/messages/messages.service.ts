import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';

const SENDER_SELECT = { id: true, name: true, avatarUrl: true } satisfies Prisma.UserSelect;

const requireParticipant = async (jobId: string, userId: string) => {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { assignment: true },
  });
  if (!job) throw AppError.notFound('Job not found');
  const isClient = job.clientId === userId;
  const isCraftsman = job.assignment?.craftsmanId === userId;
  if (!isClient && !isCraftsman) throw AppError.forbidden();
  return { job, isClient };
};

export const listMessages = async (jobId: string, userId: string) => {
  await requireParticipant(jobId, userId);
  return prisma.message.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: SENDER_SELECT } },
  });
};

export const sendMessage = async (jobId: string, senderId: string, content: string) => {
  const { job, isClient } = await requireParticipant(jobId, senderId);
  if (!job.assignment) {
    throw AppError.conflict('Chat is only available once the job is assigned');
  }
  const recipientId = isClient ? job.assignment.craftsmanId : job.clientId;

  return prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: { jobId, senderId, content },
      include: { sender: { select: SENDER_SELECT } },
    });
    await tx.notification.create({
      data: {
        userId: recipientId,
        type: NotificationType.NEW_MESSAGE,
        payload: { jobId, messageId: msg.id },
      },
    });
    return msg;
  });
};
