DELETE FROM "bucket_habits" bh
USING "buckets" b, "habits" h
WHERE bh."bucket_id" = b."id"
  AND bh."habit_id" = h."id"
  AND (
    b."owner_id" <> h."owner_id"
    OR (
      bh."approval_status" IS NOT NULL
      AND bh."approval_status" <> 'accepted'
    )
  );

DROP TABLE IF EXISTS "shared_bucket_members" CASCADE;
ALTER TABLE "bucket_habits" DROP COLUMN IF EXISTS "added_by";
ALTER TABLE "bucket_habits" DROP COLUMN IF EXISTS "approval_status";
