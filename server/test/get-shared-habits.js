/**
 * HOW TO USE (run from project root):
 *
 *   node server/test/get-shared-habits.js <userId>
 *
 * Example:
 *
 *   node server/test/get-shared-habits.js c74b180a-3d3c-4f0b-858a-c19c06416018
 *
 * Output: JSON array with each habit's id and title.
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

/**
 * Fetches all habits that have been shared with a specific user.
 * @param {string} userId - The ID of the user to check shared habits for.
 */
async function getSharedHabits(userId) {
  const databaseUrl = process.env.DATABASE_URL || process.env.NUXT_DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL or NUXT_DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  try {
    // We search for habits where the userId exists in the sharedwith array
    const habits = await sql`
      SELECT id, title FROM habits 
      WHERE ${String(userId)} = ANY(sharedwith)
      ORDER BY "updatedat" DESC
    `;
    return habits;
  } catch (error) {
    console.error('Database Error:', error.message);
    throw error;
  }
}

const targetUserId = process.argv[2];

if (!targetUserId) {
  console.log('Usage: node server/test/get-shared-habits.js <userId>');
  process.exit(1);
}

console.log(`Fetching habits shared with user: ${targetUserId}...`);

getSharedHabits(targetUserId)
  .then(habits => {
    console.log(`Found ${habits.length} shared habit(s):`);
    console.log(JSON.stringify(habits, null, 2));
  })
  .catch(err => {
    console.error('Failed to retrieve shared habits.');
    process.exit(1);
  });
