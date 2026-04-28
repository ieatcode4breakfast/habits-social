import { recalculateHabitStreak } from '../../utils/streaks';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  
  // NOTE: In a real production app, you would add a secret key check here 
  // or ensure only admin users can access this.
  
  try {
    // 1. Fetch all habits to recalculate
    const habits = await sql`SELECT id, ownerid FROM habits`;
    
    let processedCount = 0;
    
    // 2. Loop through and trigger the cascading streak engine
    for (const habit of habits) {
      await recalculateHabitStreak(sql, habit.id, habit.ownerid);
      processedCount++;
    }
    
    return {
      success: true,
      message: `Successfully recalculated streaks for ${processedCount} habits.`,
      processedCount
    };
  } catch (error: any) {
    console.error('Backfill error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to backfill streak data',
      data: error.message
    });
  }
});
