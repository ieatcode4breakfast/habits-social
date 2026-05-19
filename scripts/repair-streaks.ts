import dotenv from 'dotenv';
dotenv.config();

import { useDB, extractRows } from '../server/utils/db';
import { recalculateHabitStreak } from '../server/utils/streaks';
import { syncBucketLogsForHabit } from '../server/utils/buckets';
import { sql } from 'drizzle-orm';
import * as schema from '../server/db/schema';
import { eq, and, gte } from 'drizzle-orm';

async function main() {
  console.log('--- Database Streak & Bucket Log Repair Migration ---');
  const db = useDB();

  // 1. Identify all affected user habits where the latest completed logs have a streak_count of 0
  const queryResult = await db.execute(sql`
    SELECT DISTINCT hl.habit_id as habit_id, hl.owner_id as owner_id, MIN(hl.date) as earliest_date
    FROM habit_logs hl
    JOIN habits h ON hl.habit_id = h.id
    WHERE hl.status = 'completed'
      AND hl.streak_count = 0
    GROUP BY hl.habit_id, hl.owner_id
  `);

  interface AffectedHabit {
    habit_id: string;
    owner_id: string;
    earliest_date: string;
  }

  const affected: AffectedHabit[] = extractRows<AffectedHabit>(queryResult);

  if (affected.length === 0) {
    console.log('No affected records found. Database is healthy and consistent.');
    process.exit(0);
  }

  console.log(`Found ${affected.length} affected habits requiring repair. Starting batch recalculations...\n`);

  for (const item of affected) {
    const habitId = item.habit_id;
    const ownerId = item.owner_id;
    const earliestDate = item.earliest_date;

    console.log(`[Repairing] Habit: ${habitId} | Owner: ${ownerId} | From Date: ${earliestDate}`);

    try {
      // 2. Perform sequential incremental streak recalculation
      await recalculateHabitStreak(db, habitId, ownerId, earliestDate);
      console.log(`  -> Streak recalculated successfully.`);

      // 3. Fetch all dates from the earliest date onwards to synchronize bucket states
      const logs = await db
        .select({ date: schema.habitLogs.date })
        .from(schema.habitLogs)
        .where(
          and(
            eq(schema.habitLogs.habitId, habitId),
            eq(schema.habitLogs.ownerId, ownerId),
            gte(schema.habitLogs.date, earliestDate)
          )
        );

      const uniqueDates = [...new Set(logs.map((l: any) => l.date))];
      console.log(`  -> Syncing bucket logs for ${uniqueDates.length} distinct dates...`);

      for (const date of uniqueDates) {
        await syncBucketLogsForHabit(db, habitId, ownerId, date);
      }

      console.log(`[Success] Finished repairing habit: ${habitId}\n`);
    } catch (error) {
      console.error(`[Error] Failed to repair habit: ${habitId}`, error);
    }
  }

  console.log('--- Streak & Bucket Log Repair Complete! ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during repair migration:', err);
  process.exit(1);
});
