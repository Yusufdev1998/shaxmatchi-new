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
import { IsIn } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StudentOnlyGuard } from "../auth/student-only.guard";
import type { JwtUserPayload } from "../auth/jwt.types";
import { StudentExamsService } from "./student-exams.service";

class FinalizeAttemptDto {
  @IsIn(["passed", "failed"])
  result!: "passed" | "failed";
}

@Controller("student/exams")
@UseGuards(JwtAuthGuard, StudentOnlyGuard)
export class StudentExamsController {
  constructor(private readonly exams: StudentExamsService) {}

  @Get()
  list(@Req() req: { user: JwtUserPayload }) {
    return this.exams.listForStudent(req.user.sub);
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
    });
  }
}
