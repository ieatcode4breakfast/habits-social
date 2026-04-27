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
  
  const [target] = await sql`SELECT id, username, email, photourl FROM users WHERE id = ${friendId}::uuid`;
  
  if (!target) throw createError({ statusCode: 404 });

  return { ...target, id: target.id };
});
