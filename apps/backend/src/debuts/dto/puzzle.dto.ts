import { plainToInstance, Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

/** Must stay in sync with `@shaxmatchi/ui` EXPLANATION_SHAPE_COLORS. */
export const EXPLANATION_SHAPE_COLORS = [
  "#398841",
  "#c41e3a",
  "#2563eb",
  "#ca8a04",
  "#7c3aed",
] as const;

function transformCircles(value: unknown): PuzzleCircleDto[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    let plain: { square: string; color?: string };
    if (typeof item === "string") {
      plain = { square: item, color: EXPLANATION_SHAPE_COLORS[0] };
    } else if (item && typeof item === "object" && "square" in item) {
      const o = item as { square?: string; color?: string };
      plain = { square: o.square ?? "", ...(o.color ? { color: o.color } : {}) };
    } else {
      plain = { square: "" };
    }
    /** Instances required so ValidationPipe whitelist allows `square` / `color`. */
    return plainToInstance(PuzzleCircleDto, plain);
  });
}

export class PuzzleCircleDto {
  @IsString()
  @Matches(/^[a-h][1-8]$/)
  square!: string;

  @IsOptional()
  @IsIn([...EXPLANATION_SHAPE_COLORS])
  color?: string;
}

export class PuzzleArrowDto {
  @IsString()
  @Matches(/^[a-h][1-8]$/)
  startSquare!: string;

  @IsString()
  @Matches(/^[a-h][1-8]$/)
  endSquare!: string;

  @IsOptional()
  @IsIn([...EXPLANATION_SHAPE_COLORS])
  color?: string;
}

export class PuzzleMoveDto {
  @IsString()
  @MinLength(1)
  san!: string;

  @IsString()
  explanation!: string;

  /** Highlighted squares (rings); legacy `string[]` is normalized to objects. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuzzleCircleDto)
  @Transform(({ value }) => transformCircles(value))
  circles?: PuzzleCircleDto[];

  /** Arrows drawn on the board for this move’s explanation. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuzzleArrowDto)
  arrows?: PuzzleArrowDto[];

  /** Filename of an uploaded audio explanation (served at /uploads/audio/:filename). */
  @IsOptional()
  @IsString()
  audioUrl?: string;

  /** Seconds to wait before auto-playing the audio on the student side (0-60). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  audioDelaySeconds?: number;

  /** Whether the audio should be auto-played on the student side (default true). */
  @IsOptional()
  @IsBoolean()
  audioAutoplay?: boolean;
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
