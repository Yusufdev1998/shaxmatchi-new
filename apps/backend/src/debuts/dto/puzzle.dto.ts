import { Type } from "class-transformer";
import { IsArray, IsString, MinLength, ValidateNested } from "class-validator";

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuzzleMoveDto)
  moves!: PuzzleMoveDto[];
}

