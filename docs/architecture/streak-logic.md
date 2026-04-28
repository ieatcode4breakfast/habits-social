# Habit Streak Logic

This document outlines the architectural approach and implementation details for calculating habit streaks in the Habits Social application.

## Architectural Overview: Server-Side Calculation

The application employs a **Thin Client** architecture for streak management. Instead of calculating streaks on-the-fly in the browser, Habits Social performs these computations on the Nuxt Nitro backend.

### Rationale
1.  **Scalability (Bandwidth)**: Calculating streaks requires historical log data. For long-term users, fetching thousands of logs to calculate a single integer (the streak) is inefficient. By calculating on the server, the client only needs to receive the final integer.
2.  **Social Single Source of Truth**: Social features like the Activity Feed and notifications require the server to "know" when milestones (e.g., "10-day streak!") occur without waiting for a user to open their app.
3.  **Data Integrity**: Server-side logic prevents easy manipulation of streaks via browser developer tools, ensuring that social competition and accountability remain fair.

---

## Data Model

The streak state is persisted in the `habits` table with three primary fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `currentStreak` | `Integer` | The number of consecutive days the habit has been completed (ignoring skips). |
| `longestStreak` | `Integer` | The historical record for the most consecutive completions. |
| `streakAnchorDate` | `Date` | The date of the most recent log that contributed to or "anchored" the current streak. |

---

## Unified Calculation Engine

**CRITICAL RULE:** Streaks are ALWAYS calculated on a **daily, day-by-day basis**, regardless of whether the habit's goal frequency is Daily, Weekly, or Monthly. The `currentStreak` strictly counts consecutive days of logging activity. The frequency goals (e.g., "4 times a week") use a separate visual counter, but the streak pill badge is universally a daily measure.

> [!IMPORTANT]
> **Design Philosophy: The Unbroken Chain**
> This daily-only logic is **intentional and immutable**. While habits have frequency goals (weekly/monthly), the **Streak** is a separate measure of daily accountability. 
> *   **Forgiving:** Users can retroactively log missed days to "save" a streak.
> *   **Strict:** A "Missing Day" (gap) always breaks the chain.
> *   **Note to AI/Devs:** Do NOT suggest or implement frequency-based streak logic. The streak represents literal consecutive days of record-keeping; it is not an average.

Streaks are recalculated automatically whenever a habit log is created, updated, or deleted via the `server/utils/streaks.ts` utility.

### The Recalculation Flow
1.  **Trigger**: An API call to `/api/habitlogs` (POST or DELETE) finishes its database operation.
2.  **Fetch Logs**: All logs for the specific habit are fetched, ordered by date descending.
3.  **Anchor Identification**: The engine finds the most recent log with a valid status. To prevent timezone misalignment, the server trusts the timeline provided by the frontend and does not filter out "future" dates relative to the server's UTC clock. This is the `streakAnchorDate`.
4.  **Status Check on Anchor**:
    * If the anchor log is `failed`, the streak is immediately set to `0`.
    * If the anchor log is `completed`, the streak starts at `1` and counts backwards.
    * If the anchor log is `skipped`, the engine continues searching backwards without incrementing the count.
5.  **Backwards Iteration**: The engine steps back strictly **day-by-day** from the anchor date.
    * **Completed Day**: Increment streak by 1, continue.
    * **Skipped Day (`-`)**: Ignore it and continue. This preserves the streak without adding to the count.
    * **Failed Day (`X`) or Missing Day (Gap)**: Break the iteration immediately. The streak ends here.

### SQL Persistence
The final `currentStreak` is updated in the database. The `longestStreak` is updated using a `GREATEST` comparison to ensure it only increases if the new current streak exceeds the old record.

---

## Synchronization and Real-Time State

To prevent stale data on the frontend and eliminate the need for manual page refreshes:
- **API Payload Augmentation**: Whenever a log is mutated, the backend recalculates the streak and immediately returns both the affected `log` and the updated `habit` statistics in the HTTP response.
- **Pusher WebSockets**: The backend automatically triggers a Pusher event (`habit-updated` or `habit-deleted`) containing the recalculated state to the `user-[id]-habits` channel, ensuring real-time synchronization across all of the user's active devices.

---

## Frontend Presentation

The Vue frontend remains lightweight, binding directly to the `habit.currentStreak` value provided by the API.

### Visual "Faded" Status
To provide real-time feedback without constant polling, the frontend uses the `streakAnchorDate` to determine if a streak is currently "at risk."

Because all streaks use the unified daily logic, the faded status is also calculated the same way for all habits:

- **Normal**: If the `streakAnchorDate` is Today or Yesterday.
- **Faded (`opacity-30`)**: If the `streakAnchorDate` is strictly older than Yesterday. This indicates that while the streak hasn't "broken" (because the server only breaks it on a `failed` log or when a new day is explicitly logged after a gap), the user is at risk of losing it if they log something new now.

*(Note on Timezones: The faded visual status is calculated dynamically using the viewer's local browser clock. When viewing a friend's profile from a significantly different timezone, the visual fade indicator reflects the viewer's timeline, not strictly the owner's timeline. This is an accepted tolerance for frontend simplicity.)*

```typescript
// app/pages/index.vue and app/pages/friends/[id].vue logic
const isFaded = (habit: Habit) => {
  if (!habit || !habit.streakAnchorDate) return false;
  const anchor = startOfDay(parseISO(habit.streakAnchorDate));
  const yesterday = startOfDay(subDays(new Date(), 1));
  
  // Faded if the anchor is strictly before yesterday
  return isAfter(yesterday, anchor); 
};