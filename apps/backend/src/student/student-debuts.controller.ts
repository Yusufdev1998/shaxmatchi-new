import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StudentOnlyGuard } from "../auth/student-only.guard";
import type { JwtUserPayload } from "../auth/jwt.types";
import { StudentDebutsService } from "./student-debuts.service";

@Controller("student/debuts")
@UseGuards(JwtAuthGuard, StudentOnlyGuard)
export class StudentDebutsController {
  constructor(private readonly studentDebuts: StudentDebutsService) {}

  @Get("levels")
  listLevels(@Req() req: { user: JwtUserPayload }) {
    return this.studentDebuts.listLevels(req.user.sub);
  }

  @Get("levels/:levelId/courses")
  listCourses(@Req() req: { user: JwtUserPayload }, @Param("levelId") levelId: string) {
    return this.studentDebuts.listCourses(levelId, req.user.sub);
  }

  @Get("levels/:levelId/courses/:courseId/modules")
  listModules(
    @Req() req: { user: JwtUserPayload },
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
  ) {
    return this.studentDebuts.listModules(levelId, courseId, req.user.sub);
  }

  @Get("levels/:levelId/courses/:courseId/modules/:moduleId/tasks")
  listTasks(
    @Req() req: { user: JwtUserPayload },
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
  ) {
    return this.studentDebuts.listTasks(levelId, courseId, moduleId, req.user.sub);
  }

  @Get("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles")
  listPuzzlesForTask(
    @Req() req: { user: JwtUserPayload },
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
  ) {
    return this.studentDebuts.listPuzzlesForStudent({
      levelId,
      courseId,
      moduleId,
      taskId,
      studentId: req.user.sub,
    });
  }
}

