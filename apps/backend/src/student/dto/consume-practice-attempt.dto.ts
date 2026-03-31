import { Type } from "class-transformer";
import { IsIn, IsInt, Min, ValidateIf } from "class-validator";

export class ConsumePracticeAttemptDto {
  @IsIn(["success", "failure"])
  outcome!: "success" | "failure";

  /** Xato paytidagi yurish indeksi (0-based), faqat outcome === "failure". */
  @ValidateIf((o: ConsumePracticeAttemptDto) => o.outcome === "failure")
  @Type(() => Number)
  @IsInt()
  @Min(0)
  failureMoveIndex?: number;
}
