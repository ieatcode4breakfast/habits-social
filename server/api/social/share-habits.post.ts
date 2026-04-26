import type { IHabit } from '../../models';
import { isDummyUsername } from '../../utils/isolation';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  const { targetUserId, habitIds } = await readBody(event);
  if (!targetUserId || !Array.isArray(habitIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing targetUserId or habitIds array' });
  }

  // Get current user and target user to check isolation
  const [me] = await sql`SELECT username FROM users WHERE id = ${userId}::uuid`;
  const [target] = await sql`SELECT username FROM users WHERE id = ${targetUserId}::uuid`;

  if (!target) throw createError({ statusCode: 404, statusMessage: 'Target user not found' });

  if (isDummyUsername(me?.username) !== isDummyUsername(target.username)) {
    throw createError({ 
      statusCode: 403, 
      statusMessage: 'You can only share habits with users in your own group.' 
    });
  }

  const targetId = String(targetUserId);

  // Update each habit individually to avoid Neon HTTP driver array param issues
  for (const rawId of habitIds) {
    const habitId = String(rawId);
    await sql`
      UPDATE habits 
      SET sharedwith = array_append(sharedwith, ${targetId}),
          updatedat = NOW()
      WHERE id = ${habitId}::uuid
        AND ownerid = ${userId}
        AND NOT (${targetId} = ANY(sharedwith))
    `;
  }

  return { success: true };
});
