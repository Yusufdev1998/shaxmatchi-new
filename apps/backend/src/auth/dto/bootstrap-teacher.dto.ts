import { IsString, MinLength } from "class-validator";

export class BootstrapTeacherDto {
  @IsString()
  login!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

