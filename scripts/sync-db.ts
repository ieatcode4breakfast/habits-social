import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../server/db/schema.js';
import { sql, eq, getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import fs from 'fs';
import path from 'path';

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envFile = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim();
});

const PROD_URL = env.PRODUCTION_DATABASE_URL;
const STAGING_URL = env.STAGING_DATABASE_URL;

if (!PROD_URL || !STAGING_URL) {
  console.error('Missing PROD_URL or STAGING_URL in .env');
  process.exit(1);
}

const prodDb = drizzle(neon(PROD_URL), { schema });
const stagingDb = drizzle(neon(STAGING_URL), { schema, logger: true });

async function syncTable(tableName: string, tableSchema: any, conflictColumns: string[]) {
  console.log(`Syncing table: ${tableName}...`);
  
  const prodData = await prodDb.select().from(tableSchema);
  console.log(`Found ${prodData.length} records in Production.`);

  if (prodData.length === 0) return;

  const columns = getTableColumns(tableSchema);
  const setClause: any = {};
  for (const [key, column] of Object.entries(columns)) {
    if (conflictColumns.includes(key)) continue;
    setClause[key] = sql.raw(`excluded."${(column as any).name}"`);
  }

  console.log(`Set clause keys: ${Object.keys(setClause).join(', ')}`);

  // Split into batches
  const batchSize = 100;
  for (let i = 0; i < prodData.length; i += batchSize) {
    const batch = prodData.slice(i, i + batchSize);
    
    // Convert conflict string columns to actual column objects
    const target = conflictColumns.map(c => tableSchema[c]);

    await stagingDb
      .insert(tableSchema)
      .values(batch as any)
      .onConflictDoUpdate({
        target: target,
        set: setClause,
      });
    
    console.log(`  Processed ${Math.min(i + batchSize, prodData.length)}/${prodData.length}...`);
  }
}

async function main() {
  try {
    // 1. Users
    await syncTable('users', schema.users, ['id']);
    
    // 2. Habits
    await syncTable('habits', schema.habits, ['id']);
    
    // 3. Buckets
    await syncTable('buckets', schema.buckets, ['id']);
    
    // 4. Habit Logs
    await syncTable('habit_logs', schema.habitLogs, ['id']);
    
    // 5. Bucket Logs
    await syncTable('bucket_logs', schema.bucketLogs, ['id']);
    
    // 6. Bucket Habits (Composite PK)
    await syncTable('bucket_habits', schema.bucketHabits, ['bucketId', 'habitId']);
    
    // 7. Shared Bucket Members
    console.log('Syncing shared_bucket_members (Truncate and re-insert)...');
    const members = await prodDb.select().from(schema.sharedBucketMembers);
    await stagingDb.delete(schema.sharedBucketMembers);
    if (members.length > 0) {
      await stagingDb.insert(schema.sharedBucketMembers).values(members);
    }

    // 8. Friendships
    await syncTable('friendships', schema.friendships, ['id']);
    
    // 9. Share Events
    await syncTable('share_events', schema.shareEvents, ['id']);
    
    // 10. Sync Deletions
    await syncTable('sync_deletions', schema.syncDeletions, ['id']);

    console.log('Database sync completed successfully!');
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

main();
