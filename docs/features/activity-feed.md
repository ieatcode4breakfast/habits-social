# Habit Tracking Feed & Milestone Logic

This document outlines the logic, formatting rules, and trigger events for the habit tracking activity feed. It is designed to reward consistency, prevent notification fatigue, and clearly communicate habit progress between friends.

## 1. Milestone Days & Core Rules

### Standard Milestones
Milestones are triggered on the following streak days:
**2, 3, 4, 5, 7, 14, 21, 30, 60, 90, 100, 180, 300, Annual** (every 365 days).

### The Veteran Habit Rule
For habits that have previously reached a 365-day streak, any new streaks will skip the early milestones (2, 3, 4, and 5 days) to prevent spam. The first milestone notification for these habits will start at **7 days**.

### Post-Year Formatting Rule
Everything starting at 365 days must be explicitly formatted to show the years and days, followed by the total days in parentheses. 
* *Example:* 1-year and 20-day streak (385 days)

---

## 2. Activity Feed Triggers

### CATEGORY 1: INITIAL & ISOLATED LOGS
*Triggers for the first log of a potential streak (Day 1) or actions taken when no active streak exists.*

* **Trigger: Initial Completion (Day 1)**
  * **Content**: The very first completion for a habit that has no prior streak history.
  * **Your Activity**: You completed Morning Workout for Apr 27.
  * **Friend Activity**: Alex completed Morning Workout for Apr 27.

* **Trigger: The Comeback (Day 1 Restart)**
  * **Content**: Triggered on Day 1 when a user completes a habit after breaking a previous streak of any length.
  * **Your Activity**: You're right back at it! You logged Day 1 of Morning Workout following your reset.
  * **Friend Activity**: Alex is right back at it! They logged Day 1 of Morning Workout following their reset.

* **Trigger: Initial Skip**
  * **Content**: Marking a habit as skipped when no active streak exists.
  * **Your Activity**: You skipped No Sugar for Apr 27.
  * **Friend Activity**: Taylor skipped No Sugar for Apr 27.

* **Trigger: Initial Failure**
  * **Content**: Marking a habit as failed when no active streak exists.
  * **Your Activity**: You failed Cold Shower for Apr 27.
  * **Friend Activity**: Morgan failed Cold Shower for Apr 27.

---

### CATEGORY 2: SOCIAL & SHARING
*Triggers for visibility and network actions.*

* **Trigger: Public Commitment (New Habit)**
  * **Content**: Triggered only when a user creates a new habit and selects specific friends to share it with.
  * **Your Activity**: You committed to a new habit: Morning Workout.
  * **Friend Activity**: Alex committed to a new habit: Morning Workout.

* **Trigger: Shared a habit with you**
  * **Content**: A user grants visibility into one of their existing habits.
  * **Your Activity**: You shared Morning Workout with Morgan.
  * **Friend Activity**: Alex shared Morning Workout with you.

---

### CATEGORY 3: STREAK DYNAMICS
*Chronological triggers for building, maintaining, or losing momentum from Day 2 onwards.*

* **Trigger: Started a Streak (Day 2)**
  * **Content**: The transition from an isolated log to a streak. (Skipped under the Veteran Habit Rule).
  * **Your Activity**: You started a streak! That's 2 days in a row for Morning Workout.
  * **Friend Activity**: Alex started a streak! That's 2 days in a row for Morning Workout.

* **Trigger: Day 3 & Day 4 Completion**
  * **Content**: Reaching the 3-day or 4-day mark with a neutral tone (ends in a period). (Skipped under the Veteran Habit Rule).
  * **Your Activity**: You hit a 3-day streak on Morning Workout.
  * **Friend Activity**: Alex hit a 4-day streak on Morning Workout.

* **Trigger: Streak Milestone Reached**
  * **Content**: Hitting a major threshold from the list (5, 7, 14, 21, 30, 60, 90, 100, 180, 300). (Day 5 is skipped under the Veteran Habit Rule).
  * **Your Activity**: You hit a 100-day streak on Read 20 Pages for Apr 27!
  * **Friend Activity**: Jordan hit a 300-day streak on Read 20 Pages for Apr 27!

* **Trigger: Annual Anniversary**
  * **Content**: Reaching exactly 365 days or any multiple thereof, formatted to show years and total days in parentheses.
  * **Your Activity**: You hit a 1-year streak (365 days) on Morning Workout!
  * **Friend Activity**: Jordan hit a 2-year streak (730 days) on Read 20 Pages!

* **Trigger: Post-Year Milestone Reached**
  * **Content**: Hitting a standard milestone after an annual anniversary. Formatted to show years, days, and total days in parentheses.
  * **Your Activity**: You hit a 2-year and 90-day streak (820 days) on Morning Workout for Apr 27!
  * **Friend Activity**: Jordan hit a 1-year and 180-day streak (545 days) on Read 20 Pages for Apr 27!

* **Trigger: Standard Streak Extension**
  * **Content**: Ongoing completions on non-milestone days (e.g., Day 10).
  * **Your Activity**: You completed Morning Workout for Apr 27—extending your streak to 10 days!
  * **Friend Activity**: Alex completed Morning Workout for Apr 27—extending their streak to 10 days!

* **Trigger: Post-Year Standard Streak Extension**
  * **Content**: Ongoing completions on non-milestone days after the first year.
  * **Your Activity**: You completed Morning Workout for Apr 27—extending your streak to 1-year and 12 days (377 days)!
  * **Friend Activity**: Alex completed Morning Workout for Apr 27—extending their streak to 1-year and 12 days (377 days)!

* **Trigger: Streak Maintained (Skip)**
  * **Content**: Skipping a habit while a streak is active (the streak is paused and protected).
  * **Your Activity**: You skipped No Sugar for Apr 26; your 5-day streak remains intact.
  * **Friend Activity**: Taylor skipped No Sugar for Apr 26; their 1-year and 20-day streak (385 days) remains intact.

* **Trigger: Streak Broken (Fail/Miss)**
  * **Content**: A failure or missed day that resets an active streak to zero.
  * **Your Activity**: You failed Cold Shower for Apr 27, bringing your 60-day streak to an end.
  * **Friend Activity**: Morgan failed Cold Shower for Apr 27, bringing a 1-year and 20-day streak (385 days) to an end.
