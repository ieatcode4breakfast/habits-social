import { jwtVerify } from 'jose';
import type * as Party from 'partykit/server';
import {
  parseRealtimeInvalidationEvent,
  MAX_REALTIME_NOTIFICATION_BYTES,
  realtimeNotificationRequestSchema,
  serializeRealtimeInvalidationEvent,
  verifyRealtimeNotificationSignature,
} from '../utils/realtime';

interface RealtimeTokenPayload {
  userId: string;
  roomId: string;
}

const getEnvString = (env: Record<string, unknown>, key: string): string => {
  const value = env[key];
  return typeof value === 'string' ? value : '';
};

const encoder = new TextEncoder();

const readBoundedRequestText = async (req: Party.Request, maxBytes: number): Promise<string | null> => {
  const declaredLength = req.headers.get('content-length');
  if (declaredLength) {
    const declaredBytes = Number(declaredLength);
    if (!Number.isFinite(declaredBytes) || declaredBytes > maxBytes) return null;
  }

  if (!req.body) return '';

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }

    body += decoder.decode(value, { stream: true });
  }

  body += decoder.decode();
  if (encoder.encode(body).byteLength > maxBytes) return null;
  return body;
};

const isRealtimeTokenPayload = (payload: unknown): payload is RealtimeTokenPayload => {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  return typeof candidate.userId === 'string' && typeof candidate.roomId === 'string';
};

export const validateRealtimeConnectionToken = async (
  token: string | null,
  roomId: string,
  secret: string
): Promise<'ok' | 'unauthorized' | 'forbidden'> => {
  if (!token || !secret) return 'unauthorized';

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (!isRealtimeTokenPayload(payload) || payload.userId !== roomId || payload.roomId !== roomId) {
      return 'forbidden';
    }
    return 'ok';
  } catch {
    return 'unauthorized';
  }
};

export default class RealtimeServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  static async onBeforeConnect(req: Party.Request, lobby: Party.Lobby): Promise<Party.Request | Response> {
    const token = new URL(req.url).searchParams.get('token');
    const secret = getEnvString(lobby.env, 'REALTIME_JWT_SECRET');

    const validation = await validateRealtimeConnectionToken(token, lobby.id, secret);
    if (validation === 'unauthorized') {
      return new Response('Unauthorized', { status: 401 });
    }
    if (validation === 'forbidden') {
      return new Response('Forbidden', { status: 403 });
    }
    return req;
  }

  onMessage(_message: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection): void {
    sender.close(1008, 'Client realtime writes are not allowed');
  }

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return new Response('Unsupported Media Type', { status: 415 });
    }

    const secret = getEnvString(this.room.env, 'PARTYKIT_NOTIFY_SECRET');
    if (!secret) {
      return new Response('Realtime notification secret missing', { status: 500 });
    }

    const body = await readBoundedRequestText(req, MAX_REALTIME_NOTIFICATION_BYTES);
    if (body === null) {
      return new Response('Payload Too Large', { status: 413 });
    }

    try {
      await verifyRealtimeNotificationSignature({
        body,
        timestamp: req.headers.get('x-realtime-timestamp') || '',
        signature: req.headers.get('x-realtime-signature'),
        secret,
      });

      const parsedBody: unknown = JSON.parse(body);
      const notification = realtimeNotificationRequestSchema.parse(parsedBody);
      const serialized = serializeRealtimeInvalidationEvent(notification.event);

      if (!parseRealtimeInvalidationEvent(serialized).success) {
        return new Response('Invalid realtime event', { status: 400 });
      }

      this.room.broadcast(serialized);
      return Response.json({ ok: true });
    } catch {
      return new Response('Invalid realtime notification', { status: 400 });
    }
  }
}
