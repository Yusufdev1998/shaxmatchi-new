import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class AssignPuzzleDto {
  @IsString()
  studentId!: string;

  @IsString()
  @IsIn(["new", "test"])
  mode!: "new" | "test";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  practiceLimit?: number;
}

