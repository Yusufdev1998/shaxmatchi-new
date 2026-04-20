import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

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

  /**
   * Deadline for study-mode assignments, expressed as hours from the assignment time.
   * Server computes the absolute `dueAt` as `now + dueInHours`. Ignored for test mode.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 365)
  dueInHours?: number;
}

