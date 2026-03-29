import { IsIn, IsString } from "class-validator";

export class AssignPuzzleDto {
  @IsString()
  studentId!: string;

  @IsString()
  @IsIn(["new", "test"])
  mode!: "new" | "test";
}

