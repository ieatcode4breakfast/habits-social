import type { IUser } from '../../models';
import { isDummyUsername } from '../../utils/isolation';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { friendId } = getQuery(event);

  if (!friendId || typeof friendId !== 'string' || friendId === 'undefined') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid friendId provided'
    });
  }
  
  // Get current user and target user to check isolation
  const [me] = await sql`SELECT username FROM users WHERE id = ${userId}::uuid`;
  const [target] = await sql`SELECT id, username, email, photourl FROM users WHERE id = ${friendId}::uuid`;
  
  if (!target) throw createError({ statusCode: 404 });

  const isMeDummy = isDummyUsername(me?.username);
  const isTargetDummy = isDummyUsername(target?.username);

  if (isMeDummy !== isTargetDummy) {
    throw createError({ 
      statusCode: 403, 
      statusMessage: 'You do not have permission to view this profile.' 
    });
  }

  return { ...target, id: target.id };
});
