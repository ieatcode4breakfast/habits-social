import { z } from 'zod';
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import * as schema from '../db/schema';

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


// Drizzle-Zod Schemas
export const selectUserSchema = createSelectSchema(schema.users);
export const insertUserSchema = createInsertSchema(schema.users, {
  username: z.string().min(3).max(20),
  email: z.string().email(),
  passwordHash: z.string().min(8).max(72),
  photoUrl: z.string().url().or(z.literal('')).nullable().optional()
});

export const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  photoUrl: z.string().url().or(z.literal('')).nullable().optional()
});

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(72).optional(),
  photoUrl: z.string().url().or(z.literal('')).nullable().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided"
});

export const habitSchema = createInsertSchema(schema.habits, {
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),

  description: z.string().max(2000).optional().default(''),
  skipsCount: z.number().int().min(0).max(28).optional().default(0),
  skipsPeriod: z.enum(['none', 'weekly', 'monthly']).optional().default('weekly'),
  color: z.string().max(50).optional().default('#6366f1'),
  sharedWith: z.array(z.string().uuid()).optional().default([]),
  sortOrder: z.number().int().optional().default(0)
}).omit({ ownerId: true, createdAt: true, updatedAt: true });

export const habitUpdateSchema = habitSchema.partial();

export const habitLogSchema = createInsertSchema(schema.habitLogs, {
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  status: z.enum(['completed', 'skipped', 'failed', 'cleared', 'vacation']),
  sharedWith: z.array(z.string().uuid()).optional().default([]),
  streakCount: z.number().int().min(0).optional().default(0),
  brokenStreakCount: z.number().int().min(0).optional().default(0)
}).omit({ ownerId: true, updatedAt: true });

export const bucketSchema = createInsertSchema(schema.buckets, {
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional().default(''),
  color: z.string().max(50).optional().default('#6366f1'),
  sortOrder: z.number().int().optional().default(0)
}).extend({
  habitIds: z.array(z.string().uuid()).optional()
}).omit({ ownerId: true, createdAt: true, updatedAt: true });



export const bucketUpdateSchema = bucketSchema.partial();

export const bucketLogSchema = createInsertSchema(schema.bucketLogs, {
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  status: z.enum(['completed', 'skipped', 'failed', 'cleared', 'vacation']),
  streakCount: z.number().int().min(0).optional().default(0),
  brokenStreakCount: z.number().int().min(0).optional().default(0)
}).omit({ ownerId: true, updatedAt: true });



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

