import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StudentOnlyGuard } from "../auth/student-only.guard";
import type { JwtUserPayload } from "../auth/jwt.types";
import { AddLearningSecondsDto } from "./dto/add-learning-seconds.dto";
import { ConsumePracticeAttemptDto } from "./dto/consume-practice-attempt.dto";
import { StudentDebutsService } from "./student-debuts.service";

@Controller("student/puzzles")
@UseGuards(JwtAuthGuard, StudentOnlyGuard)
export class StudentPuzzlesController {
  constructor(private readonly studentDebuts: StudentDebutsService) {}

  @Get(":puzzleId")
  getPuzzle(@Req() req: { user: JwtUserPayload }, @Param("puzzleId") puzzleId: string) {
    return this.studentDebuts.getPuzzleForStudent({ puzzleId, studentId: req.user.sub });
  }

  @Post(":puzzleId/consume-attempt")
  consumeAttempt(
    @Req() req: { user: JwtUserPayload },
    @Param("puzzleId") puzzleId: string,
    @Body() body: ConsumePracticeAttemptDto,
  ) {
    return this.studentDebuts.consumePracticeAttemptForStudent({
      puzzleId,
      studentId: req.user.sub,
      outcome: body.outcome,
      failureMoveIndex: body.failureMoveIndex,
    });
  }

  @Post(":puzzleId/learning-seconds")
  addLearningSeconds(
    @Req() req: { user: JwtUserPayload },
    @Param("puzzleId") puzzleId: string,
    @Body() body: AddLearningSecondsDto,
  ) {
    return this.studentDebuts.addLearningSecondsForStudent({
      puzzleId,
      studentId: req.user.sub,
      deltaSeconds: body.deltaSeconds,
    });
  }
}

