import { format, parseISO } from 'date-fns';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  // Get friend IDs (only accepted friendships)
  const friendships = await sql`
    SELECT "initiatorId", "receiverId"
    FROM friendships 
    WHERE ("initiatorId" = ${userId} OR "receiverId" = ${userId}) 
      AND status = 'accepted'
  `;

  const friendIds = friendships.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId);
  const hasFriends = friendIds.length > 0;

  // Habit logs with friend visibility
  const logs = hasFriends ? await sql`
    SELECT 
      l.*, 
      h.title as "habitTitle",
      u.username, 
      u.photourl
    FROM habitlogs l
    JOIN habits h ON l.habitid::uuid = h.id
    JOIN users u ON l.ownerid::uuid = u.id
    WHERE (l.ownerid::text = ANY(${friendIds}) AND ${userId}::text = ANY(h.sharedwith))
      OR (l.ownerid::text = ${userId}::text)
    ORDER BY l.date DESC, l.updatedat DESC, l.id DESC
    LIMIT 100
  ` : await sql`
    SELECT 
      l.*, 
      h.title as "habitTitle",
      u.username, 
      u.photourl
    FROM habitlogs l
    JOIN habits h ON l.habitid::uuid = h.id
    JOIN users u ON l.ownerid::uuid = u.id
    WHERE l.ownerid::text = ${userId}::text
    ORDER BY l.date DESC, l.updatedat DESC, l.id DESC
    LIMIT 100
  `;

  // Habits committed (new habits with user_date)
  const commitments = hasFriends ? await sql`
    SELECT h.id, h.ownerid, h.user_date as date, h."createdAt" as updatedat,
           h.title as "habitTitle",
           u.username, u.photourl
    FROM habits h
    JOIN users u ON h.ownerid::uuid = u.id
    WHERE h.user_date IS NOT NULL
      AND (
        h.ownerid::text = ${userId}::text
        OR (h.ownerid::text = ANY(${friendIds}) AND ${userId}::text = ANY(h.sharedwith))
      )
    ORDER BY h.user_date DESC, h."createdAt" DESC
    LIMIT 100
  ` : await sql`
    SELECT h.id, h.ownerid, h.user_date as date, h."createdAt" as updatedat,
           h.title as "habitTitle",
           u.username, u.photourl
    FROM habits h
    JOIN users u ON h.ownerid::uuid = u.id
    WHERE h.user_date IS NOT NULL
      AND h.ownerid::text = ${userId}::text
    ORDER BY h.user_date DESC, h."createdAt" DESC
    LIMIT 100
  `;

  // Share events
  const shareEvents = hasFriends ? await sql`
    SELECT se.id, se.ownerid, se.recipientid, se.habitids,
           se.user_date as date, se.created_at as updatedat,
           u.username, u.photourl,
           ru.username as recipient_username
    FROM share_events se
    JOIN users u ON se.ownerid::uuid = u.id
    JOIN users ru ON se.recipientid::uuid = ru.id
    WHERE (
        (se.ownerid::text = ANY(${friendIds}) AND se.recipientid::text = ${userId}::text)
        OR se.ownerid::text = ${userId}::text
      )
    ORDER BY se.user_date DESC, se.created_at DESC
    LIMIT 100
  ` : await sql`
    SELECT se.id, se.ownerid, se.recipientid, se.habitids,
           se.user_date as date, se.created_at as updatedat,
           u.username, u.photourl,
           ru.username as recipient_username
    FROM share_events se
    JOIN users u ON se.ownerid::uuid = u.id
    JOIN users ru ON se.recipientid::uuid = ru.id
    WHERE se.ownerid::text = ${userId}::text
    ORDER BY se.user_date DESC, se.created_at DESC
    LIMIT 100
  `;

  // Merge and sort by date desc, timestamp desc
  const allItems = [
    ...logs.map((l: any) => ({ type: 'log', date: l.date, timestamp: l.updatedat, data: l })),
    ...commitments.map((c: any) => ({ type: 'commitment', date: c.date, timestamp: c.updatedat, data: c })),
    ...shareEvents.map((s: any) => ({ type: 'share', date: s.date, timestamp: s.updatedat, data: s }))
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
