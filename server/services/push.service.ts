import { eq, and, isNull, or, sql } from 'drizzle-orm';
import type { DBConnection } from '../types/db';
import * as schema from '../db/schema';

import { buildPushPayload } from '@block65/webcrypto-web-push';

const MAX_CONCURRENCY = 5;

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

export const getVapidConfig = (): { subject: string; publicKey: string; privateKey: string } | null => {
  const config = getPushRuntimeConfig();
  // Nuxt auto-injects Cloudflare secrets into runtimeConfig when secrets are named with
  // the NUXT_ prefix (e.g. NUXT_VAPID_PRIVATE_KEY → runtimeConfig.vapidPrivateKey).
  // We also fall back to the bare VAPID_ env vars for local dev and legacy deployments.
  const privateKey =
    config.vapidPrivateKey ||
    process.env.NUXT_VAPID_PRIVATE_KEY ||
    process.env.VAPID_PRIVATE_KEY ||
    '';
  const subject =
    config.vapidSubject ||
    process.env.NUXT_VAPID_SUBJECT ||
    process.env.VAPID_SUBJECT ||
    'mailto:noreply@habitssocial.com';
  const publicKey =
    config.public?.vapidPublicKey ||
    process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    '';
  if (!privateKey || !publicKey) return null;
  return { subject, publicKey, privateKey };
};

const getPushConfiguredOrThrow = (): { subject: string; publicKey: string; privateKey: string } => {
  const details = getVapidConfig();
  if (!details) {
    throw new Error('VAPID keys are not configured.');
  }
  return details;
};

const PUSH_TIMEOUT_MS = 5000;

function stripNarratorMarkup(text: string): string {
  return text.replace(/\[H\]|\[\/H\]|\[S:\d+]|\[\/S\]/g, '');
}

function truncatePushBody(body: string, maxLen = 80): string {
  const firstLine = body.split('\n')[0]?.trim() || '';
  if (!firstLine) return 'Sent a message';
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen - 3).trimEnd() + '...';
}

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
    messageBody: string,
    activityType?: string,
    activityMessage?: string,
  ): Promise<void> {
    if (recipientId === senderId) return;

    if (await this.hasBlock(db, recipientId, senderId)) return;

    const subscriptions = await this.findActiveSubscriptions(db, recipientId);
    if (subscriptions.length === 0) return;

    const details = getPushConfiguredOrThrow();

    let senderName = 'Someone';
    try {
      const [sender] = await db.select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, senderId));
      if (sender?.username) senderName = sender.username;
    } catch { /* non-critical: use fallback */ }

    const preview = messageBody.trim()
      ? truncatePushBody(messageBody)
      : activityMessage
        ? truncatePushBody(stripNarratorMarkup(activityMessage))
        : 'Sent a message';

    const prefix = activityType
      ? (activityType === 'COMMITMENT' ? 'Sent a message about a habit' : 'Sent a message about an activity')
      : null;

    const notificationBody = prefix ? `${prefix}: ${preview}` : preview;

    const messageData: Record<string, string> = {
      type: 'chat.message',
      title: senderName,
      body: notificationBody,
      url: `/inbox?replyToFriend=${senderId}`,
      senderId,
    };

    const sendOne = async (sub: typeof schema.pushSubscriptions.$inferSelect): Promise<void> => {
      try {
        const { headers, body, method } = await buildPushPayload(
          { data: messageData, options: { ttl: 86400 } },
          {
            endpoint: sub.endpoint,
            expirationTime: null,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          {
            subject: details.subject,
            publicKey: details.publicKey,
            privateKey: details.privateKey,
          },
        );

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);
        const response = await fetch(sub.endpoint, {
          method,
          headers,
          body: body as unknown as BodyInit,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            await this.disableSubscriptionByEndpoint(db, sub.endpoint).catch(() => {});
          }
          console.error(`[Push] Delivery failed: HTTP ${response.status}`);
        }
      } catch (error: unknown) {
        console.error(`[Push] Delivery failed:`, error);
      }
    };

    for (let i = 0; i < subscriptions.length; i += MAX_CONCURRENCY) {
      const batch = subscriptions.slice(i, i + MAX_CONCURRENCY);
      await Promise.all(batch.map(sendOne));
    }
  }
}
