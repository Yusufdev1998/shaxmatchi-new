ALTER TABLE "exam_attempts" ADD COLUMN "fail_details" jsonb;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "cooldown_seconds" integer DEFAULT 60 NOT NULL;