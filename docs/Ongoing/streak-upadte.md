# Technical Report: Habits Social Streak Logic & Synchronization

This report analyzes the failures in the current habit streak implementation following the architectural shift to server-side calculations. It identifies the root causes for incorrect streak counts and the requirement for manual page refreshes.

## 1. Issue: Timezone Misalignment (Incorrect Streak Reset) - DONE

### The Problem

The backend engine establishes "Today" using the server's system time (typically UTC). When a user in a timezone ahead of UTC (e.g., PHT or JST) logs a habit, the server may interpret that log as occurring in the "future." Because the current logic explicitly filters out logs that are "after today" relative to the server clock, it ignores the user's most recent activity, causing the loop to anchor on an older date and break the streak.

### Problematic Code

**File:** `server/utils/streaks.ts`

```
const today = startOfDay(new Date());

// Find anchor: first log that is not in the future and has a valid status
let anchorIndex = -1;
for (let i = 0; i < logs.length; i++) {
  const logDate = startOfDay(parseISO(logs[i].date));
  // ERROR: !isAfter(logDate, today) excludes current logs from ahead-of-UTC zones
  if (!isAfter(logDate, today) && ['completed', 'failed', 'skipped'].includes(logs[i].status)) {
    anchorIndex = i;
    break;
  }
}

```

### Proposed Solution

Trust the frontend's timeline. Remove the server-side `today` check entirely. Since the database query returns logs ordered descending by date, the engine should anchor on the most recent log regardless of the server's local clock.

## 2. Issue: Stale Frontend State (Manual Refresh Required) - DONE

### The Problem

When a user logs a habit, the `/api/habitlogs` endpoint successfully recalculates the streak in the database. However, the API only returns the raw `HabitLog` object back to the client. The frontend's `habit.currentStreak` state is never updated because the API response lacks the new calculation results. This forces the user to refresh the page to trigger a fresh `GET /api/habits` call to see the updated numbers.

### Problematic Code

**File:** `server/api/habitlogs/index.ts`

```
// POST/UPDATE/DELETE Blocks
const newLog = result[0];
await recalculateHabitStreak(sql, habitId, userId);

// ERROR: Only the log is returned. The updated habit streak is ignored.
return newLog; 

```

### Proposed Solution

Modify the endpoint to fetch the updated habit statistics from the `habits` table immediately after recalculation. Return this data in an augmented payload (`habitStats`) so the frontend can update its reactive state instantly.

## 3. Issue: Viewer-Biased Social "Faded" Status - TOLERABLE / SKIPPED

The "faded" UI state (indicating a streak is at risk) is calculated on the frontend using the viewer's local browser time (`new Date()`). If you view a friend's profile from a different timezone, the visual indicator is calculated against *your* "yesterday" rather than the *owner's* "yesterday," leading to inconsistent visual feedback in social views.

### Problematic Code

**File:** `app/pages/friends/[id].vue`

```
const isFaded = (habit: Habit) => {
  if (!habit || !habit.streakAnchorDate) return false;
  const anchor = startOfDay(parseISO(habit.streakAnchorDate));
  // ERROR: Uses viewer's system clock for comparison
  const yesterday = startOfDay(subDays(new Date(), 1)); 
  return isAfter(yesterday, anchor); 
};

```

### Proposed Solution

Project the current absolute time into the habit owner's timezone using `Intl.DateTimeFormat` before calculating "yesterday." This ensures the streak appears active or faded strictly from the perspective of the owner's local day.

## Implementation Checklist

| **Fix** | **Target File** | **Action** | 
| **Fix 1** | `server/utils/streaks.ts` | Remove `!isAfter(logDate, today)` validation. | 
| **Fix 2** | `server/api/habitlogs/index.ts` | Fetch and return `currentStreak` in log responses. | 
| **Fix 3** | `app/pages/index.vue` | Update `isFaded` to use localized owner time. |