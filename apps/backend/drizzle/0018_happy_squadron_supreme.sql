ALTER TABLE "puzzle_assignments" ADD COLUMN "study_hours" integer;--> statement-breakpoint
ALTER TABLE "puzzle_assignments" ADD COLUMN "cycle_practice_limit" integer;--> statement-breakpoint
UPDATE "puzzle_assignments" SET "study_hours" = GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("due_at" - "assigned_at")) / 3600)) WHERE "due_at" IS NOT NULL AND "study_hours" IS NULL;--> statement-breakpoint
UPDATE "puzzle_assignments" SET "cycle_practice_limit" = "practice_limit" WHERE "practice_limit" IS NOT NULL AND "cycle_practice_limit" IS NULL;