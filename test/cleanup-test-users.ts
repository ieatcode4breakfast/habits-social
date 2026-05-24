import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { ilike, or, notIlike, and } from 'drizzle-orm';
import { users } from '../server/db/schema';
import 'dotenv/config';

async function runCleanup() {
  const connectionString = process.env.DATABASE_URL_STAGING;
  
  if (!connectionString) {
    console.error('FATAL: DATABASE_URL_STAGING is not defined in your .env file.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log('Initiating cleanup of leaked test users on STAGING database...');
  
  const result = await db.delete(users)
    .where(
      and(
        notIlike(users.username, 'test%'),
        notIlike(users.username, 'asdf%'),
        or(
          ilike(users.username, 'stress_%'),
          ilike(users.username, 'sync_%'),
          ilike(users.username, 'logoutuser%'),
          ilike(users.username, 'habituser%'),
          ilike(users.username, 'loginuser%'),
          ilike(users.username, 'bulk_%'),
          ilike(users.username, 'integrity_%'),
          ilike(users.username, 'repro_%'),
          ilike(users.username, 'api_sync_%'),
          ilike(users.username, 'e2e%'),
          ilike(users.username, 'reg_%'),
          ilike(users.username, 'dup_%'),
          ilike(users.username, 'u_%'),
          ilike(users.username, 'f1_%'),
          ilike(users.username, 'f2_%')
        )
      )
    )
    .returning({ deletedId: users.id, username: users.username });

  console.log(`Successfully purged ${result.length} leaked test users.`);
  console.log('PostgreSQL CASCADE has wiped all associated relational data from STAGING.');
  process.exit(0);
}

runCleanup().catch(console.error);
