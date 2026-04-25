import { hash } from 'bcrypt-ts';
import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { username, email, password, photourl } = await readBody(event);

  if (!username && !email && !password && photourl === undefined) {
    return { message: 'No changes made' };
  }

  const users = await sql`SELECT * FROM users WHERE id = ${userId}::uuid`;
  if (users.length === 0) throw createError({ statusCode: 404, statusMessage: 'User not found' });
  const user = users[0] as IUser;

  const newUsername = username || user.username;
  const newEmail = email || user.email;
  const newPhotourl = photourl !== undefined ? photourl : user.photourl;
  let newPasswordHash = user.passwordHash;
  
  if (password) {
    newPasswordHash = await hash(password, 10);
  }

  const result = await sql`
    UPDATE users 
    SET username = ${newUsername}, email = ${newEmail}, photourl = ${newPhotourl}, "passwordHash" = ${newPasswordHash}
    WHERE id = ${userId}::uuid
    RETURNING *
  `;

  const updatedUser = result[0] as IUser;

  return {
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      photourl: updatedUser.photourl
    }
  };
});
