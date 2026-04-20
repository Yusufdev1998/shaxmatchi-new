import { ArrayNotEmpty, IsArray, IsUUID } from "class-validator";

export class ReorderPuzzlesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("all", { each: true })
  puzzleIds!: string[];
}
