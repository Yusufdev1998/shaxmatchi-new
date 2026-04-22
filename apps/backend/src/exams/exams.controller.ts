import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeacherOnlyGuard } from "../auth/teacher-only.guard";
import type { JwtUserPayload } from "../auth/jwt.types";
import { AssignExamDto } from "./dto/assign-exam.dto";
import { ExamDto } from "./dto/exam.dto";
import { ExamsService } from "./exams.service";

@Controller("admin/exams")
@UseGuards(JwtAuthGuard, TeacherOnlyGuard)
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list() {
    return this.exams.listExams();
  }

  @Get(":examId")
  get(@Param("examId") examId: string) {
    return this.exams.getExam(examId);
  }

  @Post()
  create(@Req() req: { user: JwtUserPayload }, @Body() dto: ExamDto) {
    return this.exams.createExam(req.user.sub, {
      name: dto.name,
      secondsPerMove: dto.secondsPerMove,
      attemptsAllowed: dto.attemptsAllowed,
      puzzleCount: dto.puzzleCount,
      taskIds: dto.taskIds,
    });
  }

  @Patch(":examId")
  update(@Param("examId") examId: string, @Body() dto: ExamDto) {
    return this.exams.updateExam(examId, {
      name: dto.name,
      secondsPerMove: dto.secondsPerMove,
      attemptsAllowed: dto.attemptsAllowed,
      puzzleCount: dto.puzzleCount,
      taskIds: dto.taskIds,
    });
  }

  @Delete(":examId")
  delete(@Param("examId") examId: string) {
    return this.exams.deleteExam(examId);
  }

  @Get(":examId/assignments")
  listAssignments(@Param("examId") examId: string) {
    return this.exams.listExamAssignments(examId);
  }

  @Post(":examId/assignments")
  assign(
    @Req() req: { user: JwtUserPayload },
    @Param("examId") examId: string,
    @Body() dto: AssignExamDto,
  ) {
    return this.exams.assignExam({
      examId,
      teacherId: req.user.sub,
      studentIds: dto.studentIds,
    });
  }

  @Delete(":examId/assignments/:assignmentId")
  unassign(
    @Param("examId") examId: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    return this.exams.unassignExam(examId, assignmentId);
  }
}
