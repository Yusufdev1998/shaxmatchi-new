import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StudentOnlyGuard } from "../auth/student-only.guard";
import type { JwtUserPayload } from "../auth/jwt.types";
import { StudentExamsService } from "./student-exams.service";

class FailDetailDto {
  @IsString()
  puzzleId!: string;

  @IsString()
  puzzleName!: string;

  @IsInt()
  @Min(0)
  puzzleIndex!: number;

  @IsInt()
  @Min(0)
  moveIndex!: number;

  @IsInt()
  @Min(1)
  moveNumber!: number;

  @IsIn(["wrong", "timeout"])
  reason!: "wrong" | "timeout";

  @IsOptional()
  @IsString()
  playedSan!: string | null;

  @IsOptional()
  @IsString()
  expectedSan!: string | null;
}

class FinalizeAttemptDto {
  @IsIn(["passed", "failed"])
  result!: "passed" | "failed";

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FailDetailDto)
  failDetails?: FailDetailDto[];
}

@Controller("student/exams")
@UseGuards(JwtAuthGuard, StudentOnlyGuard)
export class StudentExamsController {
  constructor(private readonly exams: StudentExamsService) {}

  @Get()
  list(@Req() req: { user: JwtUserPayload }) {
    return this.exams.listForStudent(req.user.sub);
  }

  // NOTE: the literal "attempts/..." routes must stay above @Get(":examId") /
  // @Post(":examId/attempts") — Nest matches in declaration order and ":examId"
  // would otherwise swallow "attempts".

  /** Resume an in-progress attempt after a reload / PWA update. */
  @Get("attempts/:attemptId")
  getAttempt(@Req() req: { user: JwtUserPayload }, @Param("attemptId") attemptId: string) {
    return this.exams.getAttempt(attemptId, req.user.sub);
  }

  /** Keep-alive so the abandonment sweeper leaves a live attempt alone. */
  @Post("attempts/:attemptId/heartbeat")
  heartbeat(@Req() req: { user: JwtUserPayload }, @Param("attemptId") attemptId: string) {
    return this.exams.touchAttempt(attemptId, req.user.sub);
  }

  @Get(":examId")
  get(@Req() req: { user: JwtUserPayload }, @Param("examId") examId: string) {
    return this.exams.getForStudent(examId, req.user.sub);
  }

  @Post(":examId/attempts")
  start(@Req() req: { user: JwtUserPayload }, @Param("examId") examId: string) {
    return this.exams.startAttempt(examId, req.user.sub);
  }

  @Patch("attempts/:attemptId")
  finalize(
    @Req() req: { user: JwtUserPayload },
    @Param("attemptId") attemptId: string,
    @Body() dto: FinalizeAttemptDto,
  ) {
    return this.exams.finalizeAttempt({
      attemptId,
      studentId: req.user.sub,
      result: dto.result,
      failDetails: dto.failDetails,
    });
  }
}
