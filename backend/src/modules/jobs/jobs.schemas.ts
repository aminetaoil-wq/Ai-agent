import { z } from 'zod';

export const createJobSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(4).max(120).trim(),
  description: z.string().min(10).max(5000).trim(),
  city: z.string().min(2).max(80).trim(),
  postcode: z.string().min(4).max(10).optional(),
  budgetCents: z.number().int().min(0).max(10_000_000).optional(),
  scheduledAt: z.coerce.date().optional(),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = createJobSchema.partial();
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

export const listJobsQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
});

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
