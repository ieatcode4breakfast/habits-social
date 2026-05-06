import { z } from 'zod';

/**
 * Extracts a single, human-readable error message from a Zod validation error.
 */
export const getZodErrorMessage = (error: z.ZodError): string => {
  const [issue] = error.issues;
  if (issue) {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  }
  return 'Validation Failed';
};

/**
 * Throws a consistent 400 error for Zod validation failures.
 */
export const throwZodError = (error: z.ZodError) => {
  throw createError({
    statusCode: 400,
    statusMessage: getZodErrorMessage(error),
    data: error.flatten()
  });
};

export const isValidEmail = (email: string): boolean => {
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!email || email.length > 255) return false;
  return EMAIL_REGEX.test(email);
};

const userBaseSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  photoUrl: z.string().url().or(z.literal('')).nullable()
});

export const registerSchema = userBaseSchema.extend({
  photoUrl: userBaseSchema.shape.photoUrl.optional()
});

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

export const updateProfileSchema = userBaseSchema.partial().refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided"
});


export const habitSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional().default(''),
  skipsCount: z.number().int().min(0).max(28).optional(),
  skipsPeriod: z.enum(['none', 'weekly', 'monthly']).optional().default('weekly'),
  color: z.string().max(50).optional().default('#6366f1'),
  sharedWith: z.array(z.string().uuid()).optional().default([]),
  sortOrder: z.number().int().optional(),
  userDate: z.string().optional()
});

export const habitUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  skipsCount: z.number().int().min(0).max(28).optional(),
  skipsPeriod: z.enum(['none', 'weekly', 'monthly']).optional(),
  color: z.string().max(50).optional(),
  sharedWith: z.array(z.string().uuid()).optional(),
  sortOrder: z.number().int().optional(),
  userDate: z.string().optional()
});

export const habitLogSchema = z.object({
  id: z.string().optional(),
  habitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['completed', 'skipped', 'failed', 'cleared', 'vacation']),
  sharedWith: z.array(z.string().uuid()).optional().default([]),
  streakCount: z.number().int().min(0).optional(),
  brokenStreakCount: z.number().int().min(0).optional()
});

export const bucketSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional().default(''),
  color: z.string().max(50).optional().default('#6366f1'),
  sortOrder: z.number().int().optional(),
  habitIds: z.array(z.string().uuid()).optional().default([])
});

export const bucketUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  color: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
  habitIds: z.array(z.string().uuid()).optional()
});

export const bucketLogSchema = z.object({
  id: z.string().optional(),
  bucketId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['completed', 'skipped', 'failed', 'cleared', 'vacation']),
  streakCount: z.number().int().min(0).optional(),
  brokenStreakCount: z.number().int().min(0).optional()
});

export const friendshipCreateSchema = z.object({
  targetUserId: z.string().uuid()
});

export const favoriteSchema = z.object({
  friendshipId: z.string().uuid(),
  favorite: z.boolean()
});

export const shareHabitsSchema = z.object({
  targetUserId: z.string().uuid(),
  habitIds: z.array(z.string().uuid()),
  userDate: z.string().optional()
});

export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1)
});
