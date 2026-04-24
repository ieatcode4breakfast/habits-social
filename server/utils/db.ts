import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../database/schema';
import fs from 'fs';
import path from 'path';

// Singleton for local dev to prevent too many connections
let sqliteDb: any = null;

export const useDB = (event: any) => {
  // In Cloudflare (Production), the D1 binding is provided in the event context
  const dbBinding = event.context.cloudflare?.env?.DB;

  if (dbBinding) {
    return drizzleD1(dbBinding, { schema });
  }

  // Fallback for local development (npm run dev)
  if (process.env.NODE_ENV === 'development') {
    if (!sqliteDb) {
      console.warn('[dev] Using local SQLite fallback for D1 database');
      const dataDir = path.resolve('.data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const sqlite = new Database(path.join(dataDir, 'local.db'));
      sqliteDb = drizzleSqlite(sqlite, { schema });
    }
    return sqliteDb;
  }

  throw new Error('Database binding "DB" not found in cloudflare environment and not in development mode');
};
