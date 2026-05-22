import { z } from 'zod';

export const MAX_REALTIME_EVENT_BYTES = 64;
export const MAX_REALTIME_NOTIFICATION_BYTES = 256;
export const REALTIME_SIGNATURE_MAX_SKEW_MS = 5 * 60 * 1000;

const realtimeInvalidationEventSchema = z.object({
  type: z.enum(['chat.changed', 'friends.changed']),
}).strict();

export const realtimeNotificationRequestSchema = z.object({
  event: realtimeInvalidationEventSchema,
}).strict();

export type RealtimeInvalidationEvent = z.infer<typeof realtimeInvalidationEventSchema>;
export type RealtimeNotificationRequest = z.infer<typeof realtimeNotificationRequestSchema>;

type RealtimeEventParseResult =
  | { success: true; data: RealtimeInvalidationEvent }
  | { success: false; error: string };

interface SignatureInput {
  body: string;
  timestamp: string;
  secret: string;
}

interface SignatureVerificationInput extends SignatureInput {
  signature: string | null;
  nowMs?: number;
  maxSkewMs?: number;
}

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
};

export const parseRealtimeInvalidationEvent = (raw: string): RealtimeEventParseResult => {
  if (encoder.encode(raw).byteLength > MAX_REALTIME_EVENT_BYTES) {
    return { success: false, error: 'Realtime event is too large' };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const validation = realtimeInvalidationEventSchema.safeParse(parsed);
    if (!validation.success) {
      return { success: false, error: 'Invalid realtime event' };
    }

    return { success: true, data: validation.data };
  } catch {
    return { success: false, error: 'Malformed realtime event' };
  }
};

export const serializeRealtimeInvalidationEvent = (event: RealtimeInvalidationEvent): string =>
  JSON.stringify(realtimeInvalidationEventSchema.parse(event));

export const createRealtimeNotificationSignature = async ({ body, timestamp, secret }: SignatureInput): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
  return toHex(signature);
};

export const verifyRealtimeNotificationSignature = async ({
  body,
  timestamp,
  signature,
  secret,
  nowMs = Date.now(),
  maxSkewMs = REALTIME_SIGNATURE_MAX_SKEW_MS,
}: SignatureVerificationInput): Promise<void> => {
  if (!signature) {
    throw new Error('Missing realtime notification signature');
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(nowMs - timestampMs) > maxSkewMs) {
    throw new Error('Stale realtime notification timestamp');
  }

  const expected = await createRealtimeNotificationSignature({ body, timestamp, secret });
  if (!timingSafeEqual(expected, signature)) {
    throw new Error('Invalid realtime notification signature');
  }
};
