import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class AddLearningSecondsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  deltaSeconds!: number;
}
