import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class AssignExamDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  studentIds!: string[];
}
