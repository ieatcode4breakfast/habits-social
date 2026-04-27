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
| `currentStreak` | `Integer` | The number of consecutive periods the habit has been completed. |
| `longestStreak` | `Integer` | The historical record for the most consecutive completions. |
| `streakAnchorDate` | `Date` | The date of the most recent log that contributed to or "anchored" the current streak. |

---

## Calculation Engine

Streaks are recalculated automatically whenever a habit log is created, updated, or deleted via the `server/utils/streaks.ts` utility.

### The Recalculation Flow
1.  **Trigger**: An API call to `/api/habitlogs` (POST or DELETE) finishes its database operation.
2.  **Fetch Logs**: All logs for the specific habit are fetched, ordered by date descending.
3.  **Anchor Identification**: The engine finds the most recent log that is not in the future.
4.  **Status Check**:
    *   If the anchor log is `failed`, the streak is immediately set to `0`.
    *   If the anchor log is `completed`, the streak starts at `1` and counts backwards.
    *   If the anchor log is `skipped`, the engine continues searching backwards without incrementing the count.
5.  **Backwards Iteration**: The engine steps back day-by-day (or period-by-period) from the anchor.
    *   **Completed**: Increment streak, continue.
    *   **Skipped**: Continue (preserves streak, no increment).
    *   **Failed / Missing**: Break iteration.

### SQL Persistence
The final `currentStreak` is updated in the database. The `longestStreak` is updated using a `GREATEST` comparison to ensure it only increases if the new current streak exceeds the old record.

---

## Frontend Presentation

The Vue frontend remains lightweight, binding directly to the `habit.currentStreak` value provided by the API.

### Visual "Faded" Status
To provide real-time feedback without constant polling, the frontend uses the `streakAnchorDate` to determine if a streak is currently "at risk."

- **Normal**: If `streakAnchorDate` is Today.
- **Faded (`opacity-30`)**: If `streakAnchorDate` is yesterday or older. This indicates that while the streak hasn't "broken" (because the server only breaks it on a `failed` log or when a new day is logged), the user has not yet completed the habit for the current period.

```typescript
// app/pages/index.vue logic
const isFaded = (habit: Habit) => {
  if (!habit || !habit.streakAnchorDate) return false;
  const anchor = startOfDay(parseISO(habit.streakAnchorDate));
  const yesterday = startOfDay(subDays(new Date(), 1));
  return isAfter(yesterday, anchor);
};
```

---

## Trigger Events

Streaks are **Action-Driven**. Time passing alone does not update the database. The streak only shifts when:
- A user logs a completion.
- A user logs a failure.
- A user logs a skip.
- A previously existing log is deleted.
