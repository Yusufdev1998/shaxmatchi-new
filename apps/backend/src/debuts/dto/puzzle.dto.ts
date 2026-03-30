import { Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

export class PuzzleMoveDto {
  @IsString()
  @MinLength(1)
  san!: string;

  @IsString()
  explanation!: string;
}

export class PuzzleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Which side the student plays in mashq / takrorlash (default white). */
  @IsOptional()
  @IsIn(["white", "black"])
  studentSide?: "white" | "black";

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuzzleMoveDto)
  moves!: PuzzleMoveDto[];
}

