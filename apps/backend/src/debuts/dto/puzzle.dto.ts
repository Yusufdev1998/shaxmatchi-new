import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from "class-validator";

export class PuzzleArrowDto {
  @IsString()
  @Matches(/^[a-h][1-8]$/)
  startSquare!: string;

  @IsString()
  @Matches(/^[a-h][1-8]$/)
  endSquare!: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class PuzzleMoveDto {
  @IsString()
  @MinLength(1)
  san!: string;

  @IsString()
  explanation!: string;

  /** Highlighted squares (ring circles), e.g. `["d5","f5"]`. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  circles?: string[];

  /** Arrows drawn on the board for this move’s explanation. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuzzleArrowDto)
  arrows?: PuzzleArrowDto[];
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

