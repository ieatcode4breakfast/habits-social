import { z } from 'zod';

const PRIVATE_IPV4_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./,
  /^0\./,
];

const isPrivateOrLocalHost = (hostname: string): boolean => {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local')) return true;
  if (lower === '[::1]' || lower === '::1' || lower === '[::]' || lower === '::') return true;
  if (lower.startsWith('[fc') || lower.startsWith('[fd') || lower.startsWith('[fe8') || lower.startsWith('[fe9') || lower.startsWith('[fea') || lower.startsWith('[feb')) return true;
  if (lower.includes(':')) {
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  }
  for (const pattern of PRIVATE_IPV4_PATTERNS) {
    if (pattern.test(lower)) return true;
  }
  return false;
};

const validateEndpoint = (endpoint: string, ctx: z.RefinementCtx): void => {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Endpoint must be a valid URL' });
    return;
  }

  if (parsed.protocol !== 'https:') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Endpoint must use https://' });
  }

  if (parsed.username || parsed.password) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Endpoint must not contain credentials' });
  }

  if (parsed.hash) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Endpoint must not contain a fragment' });
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Endpoint must not target local or private hosts' });
  }
};

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000).superRefine((val, ctx) => validateEndpoint(val, ctx)),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
  expirationTime: z.number().nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
}).strict();

export const pushDisableSchema = z.object({
  endpoint: z.string().url().max(2000).superRefine((val, ctx) => validateEndpoint(val, ctx)),
}).strict();
