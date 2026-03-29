import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StudentOnlyGuard } from "../auth/student-only.guard";
import type { JwtUserPayload } from "../auth/jwt.types";
import { StudentDebutsService } from "./student-debuts.service";

@Controller("student/puzzles")
@UseGuards(JwtAuthGuard, StudentOnlyGuard)
export class StudentPuzzlesController {
  constructor(private readonly studentDebuts: StudentDebutsService) {}

  @Get(":puzzleId")
  getPuzzle(@Req() req: { user: JwtUserPayload }, @Param("puzzleId") puzzleId: string) {
    return this.studentDebuts.getPuzzleForStudent({ puzzleId, studentId: req.user.sub });
  }
}

