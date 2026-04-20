import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  audioAutoplay?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  audioDelaySeconds?: number;
}
