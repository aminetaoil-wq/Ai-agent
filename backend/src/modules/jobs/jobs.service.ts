import { JobStatus, NotificationType, Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { JOB_INCLUDE } from './jobs.selectors';
import type { CreateJobInput, ListJobsQuery, UpdateJobInput } from './jobs.schemas';

const notify = (
  tx: Prisma.TransactionClient,
  userId: string,
  type: NotificationType,
  payload: Prisma.InputJsonValue,
) => tx.notification.create({ data: { userId, type, payload } });

export const createJob = async (clientId: string, input: CreateJobInput) => {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw AppError.badRequest('Unknown category');

  return prisma.job.create({
    data: { ...input, clientId },
    include: JOB_INCLUDE,
  });
};

export const updateJob = async (clientId: string, jobId: string, input: UpdateJobInput) => {
  const existing = await prisma.job.findUnique({ where: { id: jobId } });
  if (!existing) throw AppError.notFound('Job not found');
  if (existing.clientId !== clientId) throw AppError.forbidden();
  if (existing.status !== JobStatus.OPEN) {
    throw AppError.conflict('Job can only be edited while OPEN');
  }
  return prisma.job.update({ where: { id: jobId }, data: input, include: JOB_INCLUDE });
};

export const listOpenJobs = async (params: ListJobsQuery) => {
  const where: Prisma.JobWhereInput = {
    status: JobStatus.OPEN,
    ...(params.categoryId && { categoryId: params.categoryId }),
    ...(params.city && { city: { equals: params.city, mode: 'insensitive' } }),
  };

  const items = await prisma.job.findMany({
    where,
    include: JOB_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: params.limit + 1,
    ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
  });

  const hasMore = items.length > params.limit;
  const trimmed = hasMore ? items.slice(0, -1) : items;
  return { items: trimmed, nextCursor: hasMore ? trimmed[trimmed.length - 1]!.id : null };
};

// Capped to keep the response bounded even before we add proper pagination
// for the "my jobs" view.
const MY_JOBS_LIMIT = 100;

export const listMyJobs = async (userId: string, role: Role) => {
  const where: Prisma.JobWhereInput =
    role === Role.CLIENT
      ? { clientId: userId }
      : { assignment: { craftsmanId: userId } };

  return prisma.job.findMany({
    where,
    include: JOB_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: MY_JOBS_LIMIT,
  });
};

export const getJob = async (jobId: string, userId: string, role: Role) => {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: JOB_INCLUDE });
  if (!job) throw AppError.notFound('Job not found');

  // Open jobs are visible to any craftsman so they can decide to accept.
  if (job.status === JobStatus.OPEN && role === Role.CRAFTSMAN) return job;
  if (job.clientId === userId) return job;
  if (job.assignment?.craftsmanId === userId) return job;
  throw AppError.forbidden();
};

// Atomic: only one craftsman can win an OPEN job. Relies on the unique
// constraint on JobAssignment.jobId — concurrent acceptors hit Prisma P2002
// which the global error handler maps to 409 Conflict.
export const acceptJob = async (jobId: string, craftsmanId: string) =>
  prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId } });
    if (!job) throw AppError.notFound('Job not found');
    if (job.status !== JobStatus.OPEN) throw AppError.conflict('Job is no longer open');

    await tx.jobAssignment.create({ data: { jobId, craftsmanId } });
    const updated = await tx.job.update({
      where: { id: jobId },
      data: { status: JobStatus.ASSIGNED },
      include: JOB_INCLUDE,
    });

    await notify(tx, job.clientId, NotificationType.JOB_ACCEPTED, { jobId });
    return updated;
  });

const transitionStatus = async (
  jobId: string,
  craftsmanId: string,
  from: JobStatus,
  to: JobStatus,
  notif: NotificationType,
) =>
  prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId }, include: { assignment: true } });
    if (!job) throw AppError.notFound('Job not found');
    if (job.assignment?.craftsmanId !== craftsmanId) throw AppError.forbidden();
    if (job.status !== from) {
      throw AppError.conflict(`Cannot transition from ${job.status} to ${to}`);
    }

    const updated = await tx.job.update({
      where: { id: jobId },
      data: { status: to },
      include: JOB_INCLUDE,
    });

    if (to === JobStatus.IN_PROGRESS) {
      await tx.jobAssignment.update({ where: { jobId }, data: { startedAt: new Date() } });
    }
    if (to === JobStatus.COMPLETED) {
      await tx.jobAssignment.update({ where: { jobId }, data: { completedAt: new Date() } });
    }

    await notify(tx, job.clientId, notif, { jobId });
    return updated;
  });

export const startJob = (jobId: string, craftsmanId: string) =>
  transitionStatus(jobId, craftsmanId, JobStatus.ASSIGNED, JobStatus.IN_PROGRESS, NotificationType.JOB_STARTED);

export const completeJob = (jobId: string, craftsmanId: string) =>
  transitionStatus(jobId, craftsmanId, JobStatus.IN_PROGRESS, JobStatus.COMPLETED, NotificationType.JOB_COMPLETED);

export const cancelJob = async (jobId: string, clientId: string) =>
  prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId }, include: { assignment: true } });
    if (!job) throw AppError.notFound('Job not found');
    if (job.clientId !== clientId) throw AppError.forbidden();
    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
      throw AppError.conflict(`Job is already ${job.status}`);
    }

    const updated = await tx.job.update({
      where: { id: jobId },
      data: { status: JobStatus.CANCELLED },
      include: JOB_INCLUDE,
    });

    if (job.assignment) {
      await notify(tx, job.assignment.craftsmanId, NotificationType.JOB_CANCELLED, { jobId });
    }
    return updated;
  });
