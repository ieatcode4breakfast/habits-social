import dotenv from 'dotenv';
dotenv.config();

import { useDB } from '../server/utils/db';
import { recalculateHabitStreak } from '../server/utils/streaks';
import { syncBucketLogsForHabit } from '../server/utils/buckets';
import * as schema from '../server/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('--- Database Full Streak & Bucket Log Recalculation Migration ---');
  const db = useDB();

  // 1. Fetch all habits in the database
  const allHabits = await db.select({
    id: schema.habits.id,
    ownerId: schema.habits.ownerId,
    title: schema.habits.title
  }).from(schema.habits);

  console.log(`Found ${allHabits.length} total habits in database. Starting full recalculations...\n`);

  for (const habit of allHabits) {
    console.log(`[Processing] Habit: "${habit.title}" (${habit.id}) | Owner: ${habit.ownerId}`);

    try {
      // 2. Perform zero-trust full streak recalculation from the beginning of time
      await recalculateHabitStreak(db, habit.id, habit.ownerId);
      console.log(`  -> Streak recalculated.`);

      // 3. Fetch all dates to synchronize bucket states
      const logs = await db
        .select({ date: schema.habitLogs.date })
        .from(schema.habitLogs)
        .where(eq(schema.habitLogs.habitId, habit.id));

      const uniqueDates = [...new Set(logs.map((l: any) => l.date))];
      console.log(`  -> Syncing bucket logs for ${uniqueDates.length} distinct dates...`);

      for (const date of uniqueDates) {
        await syncBucketLogsForHabit(db, habit.id, habit.ownerId, date);
      }

      console.log(`[Success] Finished processing habit: ${habit.id}\n`);
    } catch (error) {
      console.error(`[Error] Failed to process habit: ${habit.id}`, error);
    }
  }

  console.log('--- Database Full Recalculation Complete! ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during production recalculation:', err);
  process.exit(1);
});
