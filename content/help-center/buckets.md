---
order: 5
---
# Buckets

A bucket groups multiple habits together so you can track them as one unit. Instead of logging each bucket day by hand, the bucket automatically derives its daily status from the habits inside it. It also keeps its own streak, separate from the individual habit streaks.

This guide explains how buckets determine their daily status, how streaks work for buckets, and how to create, edit, and delete a bucket.

> Important: You cannot log a bucket day directly. To change a bucket's status for any date, update the logs for the habits inside it. The bucket recalculates automatically.

## How a bucket's daily status is determined

For each day, the app looks at every habit log inside the bucket and picks the bucket status using this priority order:

| Priority | Bucket status | When it happens |
| --- | --- | --- |
| 1 | <span style="display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;border-radius:9999px;border:2px solid #a1a1aa;color:#a1a1aa;font-size:.75rem;flex-shrink:0;">○</span> Cleared | At least one habit in the bucket has no log for that day. |
| 2 | <span style="display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;border-radius:9999px;background:#10b981;color:white;font-size:.75rem;flex-shrink:0;">✓</span> Completed | At least one habit in the bucket is marked completed. |
| 3 | <span style="display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;border-radius:9999px;background:#f43f5e;color:white;font-size:.75rem;flex-shrink:0;">✕</span> Failed | Every habit in the bucket is marked failed. |
| 4 | <span style="display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;border-radius:9999px;background:#71717a;color:white;font-size:.75rem;flex-shrink:0;">−</span> Skipped | More habits are skipped than on vacation (or the count is tied). |
| 5 | <span style="display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;border-radius:9999px;background:#f59e0b;color:white;font-size:.75rem;flex-shrink:0;">🌴</span> Vacation | More habits are on vacation than skipped. |

The app checks these conditions in order and stops at the first one that matches. This means that showing up and logging every habit matters, but completing them all is not required: as long as each habit in the bucket has a log for the day, completing just one habit is enough to mark the whole bucket as completed and extend the streak.

## How bucket streaks work

Bucket streaks follow the same rules as habit streaks. For a full explanation of how completed, skipped, vacation, failed, and cleared days affect your streak, see [Habit Logs and Streaks](/help-center/habit-logs-and-streaks).

The key difference: you do not log a bucket's day directly. To keep a bucket streak going, make sure at least one habit in the bucket has a completed, skipped, or vacation log for each day.

A bucket's streak is independent of the streaks of its habits. A bucket can have a 10-day streak even if none of its individual habits has a streak that long — as long as the bucket's daily status stayed active for 10 consecutive days.

## Viewing your buckets

Open the **Buckets** page from the app's navigation. Each bucket appears as a row that shows:

- The bucket title.
- A streak badge when the current streak reaches 2 or more days (a flame icon appears at 7+ days).
- The number of habits inside the bucket.
- A read-only 7-day timeline with colored dots showing the bucket's daily status for each day.

Tap a bucket to expand it. The expanded view shows each habit inside the bucket with its own interactive timeline. You can tap any habit's day circle to change its log status. When you update a habit log, the bucket's status for that day recalculates automatically.

## Creating a bucket

From the Buckets page, tap **Add**. A form opens where you can:

- Enter a bucket title (required).
- Add a description (optional).
- Choose which of your habits to include. You can select multiple habits, or use **Select All** to add every habit at once.

Tap **Save** to create the bucket. It appears in your bucket list. The app then calculates the bucket's first daily statuses and shows them on the timeline.

You can create up to 30 buckets.

## Editing or deleting a bucket

Tap a bucket in the list to open the edit form. From here you can:

- Rename the bucket or update its description.
- Add or remove habits from the bucket. Removing a habit does not delete the habit or its logs — it only stops that habit from affecting the bucket's status and streak.
- View a calendar showing the bucket's historical daily statuses.

To delete the bucket, use the delete option inside the edit screen. Deleting a bucket removes the bucket and its derived logs permanently. This cannot be undone.

> The habits inside the bucket are not deleted. They remain on your My Habits page with all their logs and streaks intact.

## Reordering buckets

When you have more than one bucket, a **Reorder** button appears on the Buckets page. Tap it to drag buckets into the order you want. The new order is saved automatically.

## Privacy

Buckets are always private. They are never shared with friends, even if the habits inside them are shared. Only you can see your buckets and their timelines.

## FAQs

### Why can't I log a bucket day directly?

Buckets are designed to reflect the combined progress of the habits inside them. Instead of logging the bucket separately, you log each habit as usual. The bucket updates its status automatically based on your habit logs. This keeps your bucket always in sync with the actual habits it tracks.

### Why did my bucket show as cleared when I logged my habits?

A bucket shows cleared when at least one habit in the bucket is missing a log for that day. Check every habit inside the bucket to make sure each one has a log for the date you are looking at.

### If I delete a habit, what happens to the buckets that included it?

The habit is removed from any bucket it belonged to. The bucket recalculates its statuses for all affected dates. The bucket itself is not deleted, and the other habits inside it are not affected.

### Can I recover a deleted bucket?

No. Deleting a bucket removes it and all its derived logs permanently. The habits inside it are not affected and can still be viewed on the My Habits page.

### Does a bucket's streak affect my habit streaks?

No. A bucket's streak and the streaks of its habits are completely independent. Changing a habit log can affect the bucket's streak, but the bucket's streak does not change any habit's streak.

### Can my friends see my buckets?

No. Buckets are private to your account and are never visible to friends or anyone else.
