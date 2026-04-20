ALTER TABLE "puzzles" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "puzzles" SET "sort_order" = sub.rn FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "task_id" ORDER BY "created_at" ASC, "id" ASC) - 1) AS rn
  FROM "puzzles"
) AS sub
WHERE "puzzles"."id" = sub."id";
