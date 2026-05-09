ALTER TABLE "bucket_habits" ADD CONSTRAINT "bucket_habits_bucket_id_habit_id_pk" PRIMARY KEY("bucket_id","habit_id");--> statement-breakpoint
CREATE INDEX "habit_logs_feed_pagination_idx" ON "habit_logs" USING btree ("owner_id","date","updated_at","id");--> statement-breakpoint
CREATE INDEX "habits_feed_pagination_idx" ON "habits" USING btree ("owner_id","user_date","created_at","id");--> statement-breakpoint
CREATE INDEX "share_events_feed_pagination_idx" ON "share_events" USING btree ("owner_id","user_date","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique_idx" ON "users" USING btree (lower("username"));