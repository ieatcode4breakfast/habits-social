CREATE TABLE "bucket_habits" (
	"bucket_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"added_by" uuid,
	"approval_status" text DEFAULT 'approved'
);
--> statement-breakpoint
CREATE TABLE "bucket_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"streak_count" integer DEFAULT 0,
	"broken_streak_count" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "buckets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"color" text,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"streak_anchor_date" date,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"initiator_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"status" text NOT NULL,
	"initiator_favorite" boolean DEFAULT false,
	"receiver_favorite" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"habit_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"streak_count" integer DEFAULT 0,
	"broken_streak_count" integer DEFAULT 0,
	"shared_with" text[],
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"skips_count" integer DEFAULT 0,
	"skips_period" text DEFAULT 'daily',
	"color" text,
	"shared_with" text[],
	"sort_order" integer DEFAULT 0,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"streak_anchor_date" date,
	"user_date" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "share_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"habit_ids" text[] NOT NULL,
	"user_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shared_bucket_members" (
	"bucket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sync_deletions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"photo_url" text,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "bucket_logs_owner_updated_at_id_idx" ON "bucket_logs" USING btree ("owner_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "buckets_owner_updated_at_id_idx" ON "buckets" USING btree ("owner_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "habit_logs_owner_updated_at_id_idx" ON "habit_logs" USING btree ("owner_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "habits_owner_updated_at_id_idx" ON "habits" USING btree ("owner_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "sync_deletions_owner_created_at_id_idx" ON "sync_deletions" USING btree ("owner_id","created_at","id");