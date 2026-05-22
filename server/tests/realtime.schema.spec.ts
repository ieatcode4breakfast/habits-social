import './setup';
import { describe, expect, it } from 'vitest';
import {
  MAX_REALTIME_EVENT_BYTES,
  createRealtimeNotificationSignature,
  parseRealtimeInvalidationEvent,
  verifyRealtimeNotificationSignature,
} from '../utils/realtime';

describe('realtime invalidation schema', () => {
  it('accepts only chat and friends invalidation events', () => {
    expect(parseRealtimeInvalidationEvent('{"type":"chat.changed"}')).toEqual({
      success: true,
      data: { type: 'chat.changed' },
    });

    expect(parseRealtimeInvalidationEvent('{"type":"friends.changed"}')).toEqual({
      success: true,
      data: { type: 'friends.changed' },
    });
  });

  it('rejects private payload data instead of forwarding it through realtime', () => {
    const privatePayloads = [
      '{"type":"chat.changed","messageBody":"hello"}',
      '{"type":"chat.changed","senderProfile":{"username":"Dwayne"}}',
      '{"type":"friends.changed","friendship":{"status":"accepted"}}',
      '{"type":"friends.changed","habitData":{"title":"private"}}',
    ];

    for (const payload of privatePayloads) {
      expect(parseRealtimeInvalidationEvent(payload).success).toBe(false);
    }
  });

  it('rejects malformed and oversized realtime messages', () => {
    expect(parseRealtimeInvalidationEvent('{not-json').success).toBe(false);
    expect(parseRealtimeInvalidationEvent('x'.repeat(MAX_REALTIME_EVENT_BYTES + 1)).success).toBe(false);
  });
});

describe('realtime notification signing', () => {
  it('accepts a valid fresh signature', async () => {
    const body = '{"roomId":"user-1","event":{"type":"chat.changed"}}';
    const timestamp = String(Date.now());
    const secret = 'test-notify-secret';
    const signature = await createRealtimeNotificationSignature({ body, timestamp, secret });

    await expect(
      verifyRealtimeNotificationSignature({
        body,
        timestamp,
        signature,
        secret,
        nowMs: Number(timestamp),
      })
    ).resolves.toBeUndefined();
  });

  it('rejects missing, stale, or invalid signatures', async () => {
    const body = '{"roomId":"user-1","event":{"type":"friends.changed"}}';
    const timestamp = String(Date.now());
    const secret = 'test-notify-secret';
    const signature = await createRealtimeNotificationSignature({ body, timestamp, secret });

    await expect(
      verifyRealtimeNotificationSignature({ body, timestamp, signature: '', secret, nowMs: Number(timestamp) })
    ).rejects.toThrow(/signature/i);

    await expect(
      verifyRealtimeNotificationSignature({
        body,
        timestamp: String(Number(timestamp) - 10 * 60 * 1000),
        signature,
        secret,
        nowMs: Number(timestamp),
      })
    ).rejects.toThrow(/stale/i);

    await expect(
      verifyRealtimeNotificationSignature({
        body,
        timestamp,
        signature: 'bad-signature',
        secret,
        nowMs: Number(timestamp),
      })
    ).rejects.toThrow(/signature/i);
  });
});
