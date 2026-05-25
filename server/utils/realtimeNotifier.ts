import {
  createRealtimeNotificationSignature,
  type RealtimeInvalidationEvent,
  realtimeNotificationRequestSchema,
} from './realtime';
import { z } from 'zod';

const NOTIFY_TIMEOUT_MS = 1500;
const MAX_REALTIME_RECIPIENTS = 2;
const LOCAL_PARTYKIT_HOST_PATTERN = /^(localhost|127\.0\.0\.1):([1-9]\d{0,4})$/;

interface RealtimeRuntimeConfig {
  partykitNotifySecret?: string;
  public?: {
    realtimeEnabled?: boolean;
    partykitHost?: string;
  };
}

interface CloudflareRealtimeEnv {
  NUXT_PARTYKIT_NOTIFY_SECRET?: string;
  PARTYKIT_NOTIFY_SECRET?: string;
}

type RuntimeConfigGetter = () => RealtimeRuntimeConfig;

const realtimeRecipientsSchema = z.array(z.string().uuid()).min(1).max(MAX_REALTIME_RECIPIENTS);
const deployedPartykitHostSchema = z.string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9.-]+$/)
  .refine((host) => host.endsWith('.partykit.dev'), { message: 'PartyKit host must be a partykit.dev hostname' });

const localPartykitHostSchema = z.string()
  .trim()
  .regex(LOCAL_PARTYKIT_HOST_PATTERN, { message: 'Local PartyKit host must be localhost or 127.0.0.1 with a port' })
  .refine((host) => {
    const match = LOCAL_PARTYKIT_HOST_PATTERN.exec(host);
    if (!match) return false;

    const port = Number(match[2]);
    return Number.isInteger(port) && port <= 65535;
  }, { message: 'Local PartyKit port is invalid' });

const getRealtimeRuntimeConfig = (): RealtimeRuntimeConfig => {
  const maybeGetter = (globalThis as { useRuntimeConfig?: unknown }).useRuntimeConfig;
  if (typeof maybeGetter === 'function') {
    return (maybeGetter as RuntimeConfigGetter)();
  }

  try {
    return useRuntimeConfig() as RealtimeRuntimeConfig;
  } catch {
    return {};
  }
};

const normalizeAndValidateHost = (host: string): string => {
  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');

  if (deployedPartykitHostSchema.safeParse(normalized).success) return normalized;
  if (process.env.NODE_ENV !== 'production') return localPartykitHostSchema.parse(normalized);

  return deployedPartykitHostSchema.parse(normalized);
};

const buildPartykitOrigin = (host: string): string => (
  LOCAL_PARTYKIT_HOST_PATTERN.test(host) ? `http://${host}` : `https://${host}`
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const readCloudflareRealtimeEnv = (context: unknown): CloudflareRealtimeEnv | undefined => {
  if (!isRecord(context) || !isRecord(context.cloudflare) || !isRecord(context.cloudflare.env)) {
    return undefined;
  }

  const env = context.cloudflare.env;
  return {
    NUXT_PARTYKIT_NOTIFY_SECRET: typeof env.NUXT_PARTYKIT_NOTIFY_SECRET === 'string'
      ? env.NUXT_PARTYKIT_NOTIFY_SECRET
      : undefined,
    PARTYKIT_NOTIFY_SECRET: typeof env.PARTYKIT_NOTIFY_SECRET === 'string'
      ? env.PARTYKIT_NOTIFY_SECRET
      : undefined,
  };
};

export const notifyUsersRealtime = async (
  userIds: readonly string[],
  event: RealtimeInvalidationEvent
): Promise<void> => {
  const config = getRealtimeRuntimeConfig();
  
  let cloudflareEnv: CloudflareRealtimeEnv | undefined;
  try {
    cloudflareEnv = readCloudflareRealtimeEnv(useEvent().context);
  } catch {}
  
  const realtimeEnabled = config.public?.realtimeEnabled === true;
  const host = config.public?.partykitHost ? normalizeAndValidateHost(config.public.partykitHost) : '';
  const secret = cloudflareEnv?.NUXT_PARTYKIT_NOTIFY_SECRET || cloudflareEnv?.PARTYKIT_NOTIFY_SECRET || config.partykitNotifySecret;

  if (!realtimeEnabled || !host || !secret) return;

  const validatedEvent = realtimeNotificationRequestSchema.shape.event.parse(event);
  const recipientValidation = realtimeRecipientsSchema.safeParse([...new Set(userIds)]);
  if (!recipientValidation.success) {
    throw new Error('Invalid realtime recipient list');
  }
  const uniqueUserIds = recipientValidation.data;

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const body = JSON.stringify({ event: validatedEvent });
      const timestamp = String(Date.now());
      const signature = await createRealtimeNotificationSignature({ body, timestamp, secret });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NOTIFY_TIMEOUT_MS);

      try {
        const response = await fetch(`${buildPartykitOrigin(host)}/party/${encodeURIComponent(userId)}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-realtime-timestamp': timestamp,
            'x-realtime-signature': signature,
          },
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Realtime notify failed with status ${response.status}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    })
  );
};

export const notifyUsersRealtimeBestEffort = (
  userIds: readonly string[],
  event: RealtimeInvalidationEvent
): void => {
  void notifyUsersRealtime(userIds, event).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown realtime notification failure';
    console.warn('[Realtime] Best-effort invalidation failed:', message);
  });
};
