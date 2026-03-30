CREATE TYPE "puzzle_student_side" AS ENUM ('white', 'black');
ALTER TABLE "puzzles" ADD COLUMN "student_side" "puzzle_student_side" DEFAULT 'white' NOT NULL;
