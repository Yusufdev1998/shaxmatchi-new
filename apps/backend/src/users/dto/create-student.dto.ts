import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateStudentDto {
  @IsString()
  login!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  telegramId?: string;
}

