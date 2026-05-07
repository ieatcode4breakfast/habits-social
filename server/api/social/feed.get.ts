import { format, parseISO } from 'date-fns';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  // Get friend IDs (only accepted friendships)
  const friendships = await sql`
    SELECT initiator_id, receiver_id
    FROM friendships 
    WHERE (initiator_id = ${userId} OR receiver_id = ${userId}) 
      AND status = 'accepted'
  `;

  const friendIds = (friendships as any[]).map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId);
  const hasFriends = friendIds.length > 0;

  // Habit logs with friend visibility
  const logsRaw = hasFriends ? await sql`
    SELECT 
      l.id, l.habit_id, l.owner_id, l.date, l.status, l.streak_count, l.broken_streak_count, l.shared_with, l.updated_at,
      h.title as habit_title,
      u.username, 
      u.photo_url
    FROM habit_logs l
    JOIN habits h ON l.habit_id::uuid = h.id
    JOIN users u ON l.owner_id::uuid = u.id
    WHERE (l.owner_id::text = ANY(${friendIds}) AND ${userId}::text = ANY(h.shared_with))
      OR (l.owner_id::text = ${userId}::text)
    ORDER BY l.date DESC, l.updated_at DESC, l.id DESC
    LIMIT 100
  ` : await sql`
    SELECT 
      l.id, l.habit_id, l.owner_id, l.date, l.status, l.streak_count, l.broken_streak_count, l.shared_with, l.updated_at,
      h.title as habit_title,
      u.username, 
      u.photo_url
    FROM habit_logs l
    JOIN habits h ON l.habit_id::uuid = h.id
    JOIN users u ON l.owner_id::uuid = u.id
    WHERE l.owner_id::text = ${userId}::text
    ORDER BY l.date DESC, l.updated_at DESC, l.id DESC
    LIMIT 100
  `;

  // Habits committed (new habits with userDate)
  const commitmentsRaw = hasFriends ? await sql`
    SELECT h.id, h.owner_id, h.user_date as date, h.created_at as updated_at,
           h.title as habit_title,
           u.username, u.photo_url
    FROM habits h
    JOIN users u ON h.owner_id::uuid = u.id
    WHERE h.user_date IS NOT NULL
      AND (
        h.owner_id::text = ${userId}::text
        OR (h.owner_id::text = ANY(${friendIds}) AND ${userId}::text = ANY(h.shared_with))
      )
    ORDER BY h.user_date DESC, h.created_at DESC
    LIMIT 100
  ` : await sql`
    SELECT h.id, h.owner_id, h.user_date as date, h.created_at as updated_at,
           h.title as habit_title,
           u.username, u.photo_url
    FROM habits h
    JOIN users u ON h.owner_id::uuid = u.id
    WHERE h.user_date IS NOT NULL
      AND h.owner_id::text = ${userId}::text
    ORDER BY h.user_date DESC, h.created_at DESC
    LIMIT 100
  `;

  // Share events
  const shareEventsRaw = hasFriends ? await sql`
    SELECT se.id, se.owner_id, se.recipient_id, se.habit_ids,
           se.user_date as date, se.created_at as updated_at,
           u.username, u.photo_url,
           ru.username as recipient_username
    FROM share_events se
    JOIN users u ON se.owner_id::uuid = u.id
    JOIN users ru ON se.recipient_id::uuid = ru.id
    WHERE (
        (se.owner_id::text = ANY(${friendIds}) AND se.recipient_id::text = ${userId}::text)
        OR se.owner_id::text = ${userId}::text
      )
    ORDER BY se.user_date DESC, se.created_at DESC
    LIMIT 100
  ` : await sql`
    SELECT se.id, se.owner_id, se.recipient_id, se.habit_ids,
           se.user_date as date, se.created_at as updated_at,
           u.username, u.photo_url,
           ru.username as recipient_username
    FROM share_events se
    JOIN users u ON se.owner_id::uuid = u.id
    JOIN users ru ON se.recipient_id::uuid = ru.id
    WHERE se.owner_id::text = ${userId}::text
    ORDER BY se.user_date DESC, se.created_at DESC
    LIMIT 100
  `;

  // Merge and sort by date desc, timestamp desc
  const allItems = [
    ...(logsRaw as any[]).map((l: any) => ({ type: 'log', date: l.date, timestamp: l.updatedAt, data: l })),
    ...(commitmentsRaw as any[]).map((c: any) => ({ type: 'commitment', date: c.date, timestamp: c.updatedAt, data: c })),
    ...(shareEventsRaw as any[]).map((s: any) => ({ type: 'share', date: s.date, timestamp: s.updatedAt, data: s }))
  ];

  allItems.sort((a: any, b: any) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    const tsA = new Date(a.timestamp).getTime();
    const tsB = new Date(b.timestamp).getTime();
    if (tsA !== tsB) return tsB - tsA;
    return String(b.data.id).localeCompare(String(a.data.id));
  });

  return { data: allItems.slice(0, 100) };
});
