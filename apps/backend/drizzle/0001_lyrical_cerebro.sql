CREATE TYPE "public"."puzzle_assignment_mode" AS ENUM('new', 'test');--> statement-breakpoint
ALTER TABLE "puzzle_assignments" ADD COLUMN "mode" "puzzle_assignment_mode" DEFAULT 'new' NOT NULL;