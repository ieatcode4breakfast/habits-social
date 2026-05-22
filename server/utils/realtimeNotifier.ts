import {
  createRealtimeNotificationSignature,
  type RealtimeInvalidationEvent,
  realtimeNotificationRequestSchema,
} from './realtime';
import { z } from 'zod';

const NOTIFY_TIMEOUT_MS = 1500;
const MAX_REALTIME_RECIPIENTS = 2;

interface RealtimeRuntimeConfig {
  partykitNotifySecret?: string;
  public?: {
    realtimeEnabled?: boolean;
    partykitHost?: string;
  };
}

type RuntimeConfigGetter = () => RealtimeRuntimeConfig;

const realtimeRecipientsSchema = z.array(z.string().uuid()).min(1).max(MAX_REALTIME_RECIPIENTS);
const partykitHostSchema = z.string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9.-]+$/)
  .refine((host) => host.endsWith('.partykit.dev'), { message: 'PartyKit host must be a partykit.dev hostname' });

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
  return partykitHostSchema.parse(normalized);
};

export const notifyUsersRealtime = async (
  userIds: readonly string[],
  event: RealtimeInvalidationEvent
): Promise<void> => {
  const config = getRealtimeRuntimeConfig();
  const realtimeEnabled = config.public?.realtimeEnabled === true;
  const host = config.public?.partykitHost ? normalizeAndValidateHost(config.public.partykitHost) : '';
  const secret = config.partykitNotifySecret;

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
        const response = await fetch(`https://${host}/party/${encodeURIComponent(userId)}`, {
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
