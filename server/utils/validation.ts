import { z } from 'zod';
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import * as schema from '../db/schema';
import { zId, zShortText, zLongText, zColor, zDateString, zStandardArray, zPassword, zLoginPassword } from './schemaPrimitives';


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
  photoUrl: z.string().url().max(2048).or(z.literal('')).nullable().optional()
});

export const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: zPassword,
  photoUrl: z.string().url().max(2048).or(z.literal('')).nullable().optional()
});

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: zLoginPassword
});


export const updateProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(72).optional(),
  currentPassword: z.string().min(1).optional(),
  photoUrl: z.string().url().max(2048).or(z.literal('')).nullable().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided"
}).refine(data => !((data.password || data.email) && !data.currentPassword), {
  message: "Current password is required to update sensitive information (password or email)",
  path: ["currentPassword"]
});

export const habitSchema = createInsertSchema(schema.habits, {
  id: zId.optional(),
  title: zShortText.min(1),

  description: zLongText.optional().default(''),
  skipsCount: z.number().int().min(0).max(28).optional().default(0),
  skipsPeriod: z.enum(['none', 'weekly', 'monthly']).optional().default('weekly'),
  color: zColor.optional().default('#6366f1'),
  sharedWith: zStandardArray(zId).optional().default([]),
  sortOrder: z.number().int().optional().default(0)
}).omit({ ownerId: true, createdAt: true, updatedAt: true, currentStreak: true, longestStreak: true, streakAnchorDate: true });


export const habitUpdateSchema = habitSchema.omit({ userDate: true }).partial();

export const habitLogSchema = createInsertSchema(schema.habitLogs, {
  id: z.string().optional(),
  date: zDateString,

  status: z.enum(['completed', 'skipped', 'failed', 'cleared', 'vacation']),
  sharedWith: zStandardArray(zId).optional().default([])
}).omit({ ownerId: true, updatedAt: true, streakCount: true, brokenStreakCount: true });


export const bucketSchema = createInsertSchema(schema.buckets, {
  id: zId.optional(),
  title: zShortText.min(1),
  description: zLongText.optional().default(''),
  color: zColor.optional().default('#6366f1'),
  sortOrder: z.number().int().optional().default(0)
}).extend({
  habitIds: zStandardArray(zId).optional()
}).omit({ ownerId: true, createdAt: true, updatedAt: true, currentStreak: true, longestStreak: true, streakAnchorDate: true });




export const bucketUpdateSchema = bucketSchema.partial();

export const bucketLogSchema = createInsertSchema(schema.bucketLogs, {
  id: z.string().optional(),
  date: zDateString,

  status: z.enum(['completed', 'skipped', 'failed', 'cleared', 'vacation'])
}).omit({ ownerId: true, updatedAt: true, streakCount: true, brokenStreakCount: true });




export const friendshipCreateSchema = z.object({
  targetUserId: z.string().uuid()
});

export const favoriteSchema = z.object({
  friendshipId: z.string().uuid(),
  favorite: z.boolean()
});

export const shareHabitsSchema = z.object({
  targetUserId: zId,
  habitIds: zStandardArray(zId),
  userDate: zDateString.optional()
});

export const shareHabitSchema = z.object({
  targetUserId: zId,
  habitId: zId,
  userDate: zDateString.optional()
});

export const habitReorderSchema = z.object({
  ids: zStandardArray(zId).min(1).max(30)
});

export const bucketReorderSchema = z.object({
  ids: zStandardArray(zId).min(1).max(50)
});

export const feedItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    photoUrl: z.string().url().or(z.literal('')).nullable().optional().default(null)
  }),
  habit: z.object({
    id: z.string().nullable().optional().default(null),
    title: z.string()
  }),
  habits: z.array(z.object({
    id: z.string().nullable().optional().default(null),
    title: z.string()
  })).optional(),
  message: z.string(),
  date: z.string(),
  timestamp: z.preprocess((arg) => {
    if (typeof arg === 'string') return new Date(arg);
    return arg;
  }, z.date()),
  weeklyStatus: z.array(z.object({
    date: z.string(),
    status: z.string().nullable().optional().transform(v => v === null ? undefined : v)
  })).optional(),
  streakCount: z.number().int().optional(),
  frequencyText: z.string().max(120).optional()
});

export const chatMessageSchema = z.object({
  body: z.string().min(1).max(5000).refine(s => s.trim().length > 0, { message: "Message cannot be empty or only whitespace" }),
  replyToActivity: feedItemSchema.optional()
}).strict();

export const conversationIdSchema = zId;
export const friendIdSchema = zId;
export const messageIdSchema = zId;


export const syncQuerySchema = z.object({
  lastSynced: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().int().min(0).max(5000).default(50),
  cursors: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.length > 2048) {
        throw new Error('Payload too large');
      }
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }, z.record(z.string().max(100), z.string().max(255))).refine(val => Object.keys(val).length <= 10, { message: "Too many cursor entries" }).optional()
});


