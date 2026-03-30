import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  login?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  telegramId?: string;
}

