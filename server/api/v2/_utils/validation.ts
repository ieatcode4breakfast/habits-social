import { z } from 'zod';

export const isValidEmail = (email: string): boolean => {
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!email || email.length > 255) return false;
  return EMAIL_REGEX.test(email);
};

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(20),
  photourl: z.string().max(2000).optional()
});

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  photourl: z.string().or(z.literal('')).nullable().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided"
});

export const habitSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional().default(''),
  skipsCount: z.number().int().min(0).max(28).optional(),
  skipsPeriod: z.enum(['none', 'weekly', 'monthly']).optional().default('weekly'),
  color: z.string().max(50).optional().default('#6366f1'),
  sharedwith: z.array(z.string().uuid()).optional().default([]),
  sortOrder: z.number().int().optional(),
  user_date: z.string().optional()
});

export const habitUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  skipsCount: z.number().int().min(0).max(28).optional(),
  skipsPeriod: z.enum(['none', 'weekly', 'monthly']).optional(),
  color: z.string().max(50).optional(),
  sharedwith: z.array(z.string().uuid()).optional(),
  sortOrder: z.number().int().optional(),
  user_date: z.string().optional()
});

export const habitLogSchema = z.object({
  id: z.string().optional(),
  habitid: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['completed', 'skipped', 'failed', 'cleared', 'vacation']),
  sharedwith: z.array(z.string().uuid()).optional().default([]),
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
  bucketid: z.string().uuid(),
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
  user_date: z.string().optional()
});

export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1)
});
