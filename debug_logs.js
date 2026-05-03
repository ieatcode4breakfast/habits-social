import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon('postgresql://neondb_owner:npg_vwzDlF8Tn4fe@ep-red-bread-aovp9qdu-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

  console.log('Fetching recent habit logs...');
  const logs = await sql`SELECT id, habitid, date, status FROM habitlogs ORDER BY updatedat DESC LIMIT 10`;
  console.log('Habit Logs:', logs);

  console.log('\nFetching recent bucket logs...');
  const bLogs = await sql`SELECT id, bucketid, date, status FROM bucketlogs ORDER BY updatedat DESC LIMIT 10`;
  console.log('Bucket Logs:', bLogs);

  console.log('\nFetching buckets and habits...');
  const bucketHabits = await sql`SELECT * FROM bucket_habits`;
  console.log('Bucket Habits:', bucketHabits);
}

main().catch(console.error);
