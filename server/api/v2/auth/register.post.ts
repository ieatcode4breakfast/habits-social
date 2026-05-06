import { hash } from 'bcrypt-ts';
import { useDB as _useDB } from '../_utils/db';
import { generateToken as _generateToken } from '../_utils/auth';
import { registerSchema, throwZodError } from '../_utils/validation';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const sql = useDB(event);

  const body = await readBody(event);
  const validation = registerSchema.safeParse(body);
  
  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { email, password, username, photourl } = validation.data;

  const existingUser = await sql`SELECT 1 FROM users WHERE email ILIKE ${email} OR username ILIKE ${username}`;
  if (existingUser.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Email or username already taken' });
  }

  const passwordHash = await hash(password, 10);

  const result = await sql`
    INSERT INTO users (email, username, "passwordHash", "createdAt", photourl)
    VALUES (${email}, ${username}, ${passwordHash}, NOW(), ${photourl || null})
    RETURNING id, email, username, photourl
  `;

  if (result.length === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user' });
  }

  const user = result[0];
  const token = await generateToken(user.id, event);

  return { data: { token, id: user.id, email: user.email, username: user.username, photourl: user.photourl } };
});
