import { eq, and, isNull, or, sql } from 'drizzle-orm';
import type { DBConnection } from '../types/db';
import * as schema from '../db/schema';

const MAX_CONCURRENCY = 5;

export interface PushDeliveryPayload {
  type: 'chat.message';
  title: string;
  body: string;
  url: string;
}

interface PushRuntimeConfig {
  vapidPrivateKey?: string;
  vapidSubject?: string;
  public?: {
    vapidPublicKey?: string;
  };
}

const getPushRuntimeConfig = (): PushRuntimeConfig => {
  try {
    return useRuntimeConfig() as unknown as PushRuntimeConfig;
  } catch {
    return {};
  }
};

const getVapidDetails = (): { subject: string; publicKey: string; privateKey: string } | null => {
  const config = getPushRuntimeConfig();
  const privateKey = config.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY || '';
  const subject = config.vapidSubject || process.env.VAPID_SUBJECT || 'mailto:noreply@habitssocial.com';
  const publicKey = config.public?.vapidPublicKey || process.env.VAPID_PUBLIC_KEY || '';
  if (!privateKey || !publicKey) return null;
  return { subject, publicKey, privateKey };
};

const isPushConfigured = (): boolean => getVapidDetails() !== null;

const getPushConfiguredOrThrow = (): { subject: string; publicKey: string; privateKey: string } => {
  const details = getVapidDetails();
  if (!details) {
    throw new Error('VAPID keys are not configured.');
  }
  return details;
};

const PUSH_TIMEOUT_MS = 5000;

export class PushService {
  static async findActiveSubscriptions(db: DBConnection, userId: string): Promise<typeof schema.pushSubscriptions.$inferSelect[]> {
    return await db.select()
      .from(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.userId, userId),
          isNull(schema.pushSubscriptions.disabledAt),
          or(
            isNull(schema.pushSubscriptions.expirationTime),
            sql`${schema.pushSubscriptions.expirationTime} > now()`
          )
        )
      );
  }

  static async upsertSubscription(
    db: DBConnection,
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    expirationTime: Date | null,
    userAgent: string | null
  ): Promise<typeof schema.pushSubscriptions.$inferSelect> {
    const [result] = await db
      .insert(schema.pushSubscriptions)
      .values({
        id: crypto.randomUUID(),
        userId,
        endpoint,
        p256dh,
        auth,
        expirationTime,
        userAgent,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.pushSubscriptions.endpoint,
        set: {
          userId,
          p256dh,
          auth,
          expirationTime,
          userAgent,
          disabledAt: null as Date | null,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return result!;
  }

  static async disableSubscription(db: DBConnection, userId: string, endpoint: string): Promise<void> {
    await db
      .update(schema.pushSubscriptions)
      .set({ disabledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schema.pushSubscriptions.endpoint, endpoint),
          eq(schema.pushSubscriptions.userId, userId)
        )
      );
  }

  static async disableSubscriptionByEndpoint(db: DBConnection, endpoint: string): Promise<void> {
    await db
      .update(schema.pushSubscriptions)
      .set({ disabledAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.pushSubscriptions.endpoint, endpoint));
  }

  static async hasBlock(db: DBConnection, userA: string, userB: string): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.userBlocks)
      .where(
        or(
          and(eq(schema.userBlocks.blockerId, userA), eq(schema.userBlocks.blockedId, userB)),
          and(eq(schema.userBlocks.blockerId, userB), eq(schema.userBlocks.blockedId, userA))
        )
      );
    return result!.count > 0;
  }

  static async notifyUser(
    db: DBConnection,
    recipientId: string,
    senderId: string,
  ): Promise<void> {
    if (recipientId === senderId) return;

    if (await this.hasBlock(db, recipientId, senderId)) return;

    const subscriptions = await this.findActiveSubscriptions(db, recipientId);
    if (subscriptions.length === 0) return;

    let webpush: typeof import('web-push');
    try {
      webpush = await import('web-push');
    } catch (error: unknown) {
      const safeMsg = error instanceof Error ? error.message : 'Unknown import failure';
      console.warn(`[Push] web-push import failed: ${safeMsg}`);
      return;
    }

    const details = getPushConfiguredOrThrow();
    webpush.setVapidDetails(details.subject, details.publicKey, details.privateKey);

    const payload: PushDeliveryPayload = {
      type: 'chat.message',
      title: 'New message on Habits Social',
      body: 'Open Inbox to view it.',
      url: '/inbox',
    };
    const payloadJson = JSON.stringify(payload);

    const sendOne = async (sub: typeof schema.pushSubscriptions.$inferSelect): Promise<void> => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadJson,
          { TTL: 86400, timeout: PUSH_TIMEOUT_MS }
        );
      } catch (error: unknown) {
        if (error && typeof error === 'object') {
          const err = error as Record<string, unknown>;
          if (err.statusCode === 404 || err.statusCode === 410) {
            await this.disableSubscriptionByEndpoint(db, sub.endpoint).catch(() => {});
          }
        }
        const safeMsg = error instanceof Error ? error.message : 'Unknown push failure';
        console.warn(`[Push] Delivery failed: ${safeMsg}`);
      }
    };

    for (let i = 0; i < subscriptions.length; i += MAX_CONCURRENCY) {
      const batch = subscriptions.slice(i, i + MAX_CONCURRENCY);
      await Promise.all(batch.map(sendOne));
    }
  }
}
