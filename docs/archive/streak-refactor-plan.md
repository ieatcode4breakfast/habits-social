# Streak Logic Refactor Plan (Stale - Do Not Use, Completed 2026-04-27)

This document outlines the architectural shift from a "Thick Client" to a "Thin Client" approach for calculating habit streaks, alongside the detailed rationale for this migration.

## The Rationale: Why Server-Side Calculation?

Currently, the Vue frontend fetches raw logs and calculates streaks dynamically. While this saves server compute costs, moving this computation to the Nuxt Nitro backend is essential for a social application for three primary reasons:

### 1. The "Bandwidth" Cost (Data Transfer over Wire)
To calculate a streak in the browser, the browser must first possess the raw data.
* As users maintain habits over years, they accumulate thousands of logs (e.g., 10 habits over 3 years = 10,000 logs).
* Fetching and sending 10,000 rows of JSON on every dashboard load introduces significant latency and high bandwidth costs (egress). 
* **The Solution:** The server calculates the streak once on write, and sends a single integer (`currentStreak = 13`) to the client, keeping payload sizes infinitely scalable.

### 2. The "Social" Barrier (Single Source of Truth)
A social app requires the server to "see" and understand user progress to trigger external features.
* **Activity Feed:** If the browser calculates streaks, the backend cannot generate "Alex hit 100 days!" feed events because it does not inherently know when a milestone occurs.
* **Notifications:** Push notifications cannot be sent while a user is offline if the logic only runs when their browser tab is open.
* **Friend Profiles:** Loading a friend's profile would require downloading their entire log history just to display their current streak.

### 3. The Integrity Factor (Anti-Cheating)
In a social accountability application, data integrity matters.
* Client-side logic can be manipulated via browser developer tools.
* Moving the logic to the backend establishes the server as the "referee," making it significantly harder to falsify streaks.

---

## Implementation Plan

The backend architecture is **Action-Driven**. Time passing (blank days) only "fades" streaks; it does not break them. Streaks are only recalculated and broken when explicit log actions (Complete, Fail) occur.

### Phase 1: Database Migration
1. **Add new columns:** Alter the `habits` table in Neon to add:
   - `"currentStreak"` (INTEGER, default 0)
   - `"longestStreak"` (INTEGER, default 0) - Required for the "Veteran Habit Rule".
   - `"streakAnchorDate"` (DATE) - Required to tell the frontend if the streak should be visually "faded".
2. **Backfill existing data:** Execute a one-off script to loop through existing habits, apply the backward-counting logic to historical logs, and populate the new columns to prevent data loss.

### Phase 2: Backend Logic
1. **Utility Function:** Create `server/utils/streaks.ts` to house `recalculateHabitStreak()`. This function will query past logs, count backwards from the most recent "anchor" log, and update the `habits` table.
2. **API Updates:** Modify `server/api/habitlogs/index.ts`. After any `POST` (upsert) or `DELETE` request, the endpoint will call `recalculateHabitStreak()` to ensure the parent habit's streak is instantly synced.
3. **Model Updates:** Update the `IHabit` interface in `server/models/index.ts` with the new fields.

### Phase 3: Frontend Cleanup
1. **Remove Heavy Logic:** Delete the `streakInfoMap` and the 365-day loops from `app/pages/index.vue` and `app/pages/friends/[id].vue`.
2. **Faded Status Logic:** Add a simple `isFaded(habit)` method that checks if `habit.streakAnchorDate` is older than yesterday.
3. **UI Binding:** Update the streak badges to bind directly to `habit.currentStreak`.
