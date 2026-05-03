# Habit Streak Logic

This document outlines the core logic for calculating and evaluating habit streaks.

## Data Model

The streak state is persisted across the parent entities (`habits` and `buckets`) and their individual daily logs (`habitlogs` and `bucketlogs`).

**Parent `habits` and `buckets` (Current State):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `currentStreak` | `Integer` | The number of consecutive days the entity has been completed (ignoring skips). |
| `longestStreak` | `Integer` | The historical record for the most consecutive completions. |
| `streakAnchorDate` | `Date` | The date of the most recent log that contributed to or "anchored" the current streak. |

**Child `habitlogs` and `bucketlogs` (Historical Snapshots):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `streakCount` | `Integer` | The active streak count strictly at the time this log was recorded. |
| `brokenStreakCount` | `Integer` | If the log is a "fail," this records the streak number that was just lost. |

---

## Unified Calculation Engine

**CRITICAL RULE:** Streaks are ALWAYS calculated on a **daily, day-by-day basis**, regardless of whether the habit's goal frequency is Daily, Weekly, or Monthly. The `currentStreak` strictly counts consecutive days of logging activity. The frequency goals (e.g., "4 times a week") use a separate visual counter, but the streak pill badge is universally a daily measure.

> [!IMPORTANT]
> **Design Philosophy: The Unbroken Chain**
> This daily-only logic is **intentional and immutable**. While habits have frequency goals (weekly/monthly), the **Streak** is a separate measure of daily accountability. 
> * **Forgiving:** Users can retroactively log missed days to "save" a streak.
> * **Strict:** A "Missing Day" (gap > 1 day) always breaks the chain.
> * **Security Limit:** Retroactive edits are strictly limited to a **14-day trailing window** to prevent massive historical manipulation.

Streaks are recalculated automatically whenever a habit log or bucket log is created, updated, or deleted.

### The Forward Cascading Update Flow
To ensure data integrity when users retroactively log or delete days, the engine uses an incremental forward-cascade approach:

1.  **Trigger & Context**: A modification occurs. The system identifies the specific `fromDate` of the modification.
2.  **State Recovery**: The engine evaluates the last known log *immediately preceding* the `fromDate` to capture the `runningStreak` baseline.
3.  **Chronological Iteration**: The engine evaluates all logs from the `fromDate` onward, ordered ascending by date.
4.  **Daily Processing Logic**: As it iterates forward day-by-day:
    * **Gap Detection**: If there is a >1 day gap between the previous log and the current log, the `runningStreak` is reset to 0 before evaluating the current day.
    * **Completed Day**: Increment the streak by 1.
    * **Skipped Day**: Ignore it. The streak remains intact (paused).
    * **Failed Day**: Save the `runningStreak` into `brokenStreakCount`, then reset `runningStreak` to 0.
5.  **Log Snapshot Stamping**: Every log evaluated in this chain is updated with its specific `streakCount` and `brokenStreakCount`.
6.  **Final Parent Update**: The final `runningStreak`, the highest observed `maxStreak` (Longest Streak), and the date of the most recent valid log (`streakAnchorDate`) are saved back to the parent entity.

---

## Frontend Presentation

The frontend remains lightweight, binding directly to the `habit.currentStreak` value.

### Visual "Faded" Status
To provide visual feedback, the frontend uses the `streakAnchorDate` to determine if a streak is currently "at risk."

Because all streaks use the unified daily logic, the faded status is also calculated the same way for all habits:

- **Normal**: If the `streakAnchorDate` is Today or Yesterday.
- **Faded (`opacity-30`)**: If the `streakAnchorDate` is strictly older than Yesterday. This indicates that while the streak hasn't "broken" (because it only breaks on a `failed` log or when a new day is explicitly logged after a gap), the user is at risk of losing it if they log something new now.

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
```