ALTER TABLE "puzzle_assignments" ADD COLUMN "practice_limit" integer;--> statement-breakpoint
ALTER TABLE "puzzle_assignments" ADD COLUMN "practice_attempts_used" integer DEFAULT 0 NOT NULL;
