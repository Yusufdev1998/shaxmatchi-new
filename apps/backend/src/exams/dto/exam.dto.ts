import { ArrayNotEmpty, IsArray, IsInt, IsString, Max, Min, MinLength } from "class-validator";

export class ExamDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(3600)
  secondsPerMove!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  attemptsAllowed!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  puzzleCount!: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  taskIds!: string[];
}
