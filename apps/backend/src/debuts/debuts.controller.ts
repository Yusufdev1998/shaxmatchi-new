import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeacherOnlyGuard } from "../auth/teacher-only.guard";
import type { JwtUserPayload } from "../auth/jwt.types";
import { DebutsService } from "./debuts.service";
import { AssignPuzzleDto } from "./dto/assign-puzzle.dto";
import { NameDto } from "./dto/name.dto";
import { PuzzleDto } from "./dto/puzzle.dto";
import { ReorderPuzzlesDto } from "./dto/reorder-puzzles.dto";

@Controller("admin/debuts")
@UseGuards(JwtAuthGuard, TeacherOnlyGuard)
export class DebutsController {
  constructor(private readonly debuts: DebutsService) {}

  // Levels
  @Get("levels")
  listLevels() {
    return this.debuts.listLevels();
  }

  @Post("levels")
  createLevel(@Body() dto: NameDto) {
    return this.debuts.createLevel(dto.name);
  }

  @Patch("levels/:levelId")
  updateLevel(@Param("levelId") levelId: string, @Body() dto: NameDto) {
    return this.debuts.updateLevel(levelId, dto.name);
  }

  @Delete("levels/:levelId")
  deleteLevel(@Param("levelId") levelId: string) {
    return this.debuts.deleteLevel(levelId);
  }

  // Courses
  @Get("levels/:levelId/courses")
  listCourses(@Param("levelId") levelId: string) {
    return this.debuts.listCourses(levelId);
  }

  @Post("levels/:levelId/courses")
  createCourse(@Param("levelId") levelId: string, @Body() dto: NameDto) {
    return this.debuts.createCourse(levelId, dto.name);
  }

  @Patch("levels/:levelId/courses/:courseId")
  updateCourse(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Body() dto: NameDto,
  ) {
    return this.debuts.updateCourse(levelId, courseId, dto.name);
  }

  @Delete("levels/:levelId/courses/:courseId")
  deleteCourse(@Param("levelId") levelId: string, @Param("courseId") courseId: string) {
    return this.debuts.deleteCourse(levelId, courseId);
  }

  // Modules
  @Get("levels/:levelId/courses/:courseId/modules")
  listModules(@Param("levelId") levelId: string, @Param("courseId") courseId: string) {
    return this.debuts.listModules(levelId, courseId);
  }

  @Post("levels/:levelId/courses/:courseId/modules")
  createModule(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Body() dto: NameDto,
  ) {
    return this.debuts.createModule(levelId, courseId, dto.name);
  }

  @Patch("levels/:levelId/courses/:courseId/modules/:moduleId")
  updateModule(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Body() dto: NameDto,
  ) {
    return this.debuts.updateModule(levelId, courseId, moduleId, dto.name);
  }

  @Delete("levels/:levelId/courses/:courseId/modules/:moduleId")
  deleteModule(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
  ) {
    return this.debuts.deleteModule(levelId, courseId, moduleId);
  }

  // Tasks
  @Get("levels/:levelId/courses/:courseId/modules/:moduleId/tasks")
  listTasks(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
  ) {
    return this.debuts.listTasks(levelId, courseId, moduleId);
  }

  @Post("levels/:levelId/courses/:courseId/modules/:moduleId/tasks")
  createTask(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Body() dto: NameDto,
  ) {
    return this.debuts.createTask(levelId, courseId, moduleId, dto.name);
  }

  @Patch("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId")
  updateTask(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
    @Body() dto: NameDto,
  ) {
    return this.debuts.updateTask(levelId, courseId, moduleId, taskId, dto.name);
  }

  @Delete("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId")
  deleteTask(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
  ) {
    return this.debuts.deleteTask(levelId, courseId, moduleId, taskId);
  }

  // Puzzles
  @Get("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles")
  listPuzzles(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
  ) {
    return this.debuts.listPuzzles(levelId, courseId, moduleId, taskId);
  }

  @Post("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles")
  createPuzzle(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
    @Body() dto: PuzzleDto,
  ) {
    return this.debuts.createPuzzle(levelId, courseId, moduleId, taskId, {
      name: dto.name,
      moves: dto.moves,
      studentSide: dto.studentSide,
    });
  }

  @Patch("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles/reorder")
  reorderPuzzles(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
    @Body() dto: ReorderPuzzlesDto,
  ) {
    return this.debuts.reorderPuzzles(levelId, courseId, moduleId, taskId, dto.puzzleIds);
  }

  @Patch("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles/:puzzleId")
  updatePuzzle(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
    @Param("puzzleId") puzzleId: string,
    @Body() dto: PuzzleDto,
  ) {
    return this.debuts.updatePuzzle(levelId, courseId, moduleId, taskId, puzzleId, {
      name: dto.name,
      moves: dto.moves,
      studentSide: dto.studentSide,
    });
  }

  @Delete("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles/:puzzleId")
  deletePuzzle(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
    @Param("puzzleId") puzzleId: string,
  ) {
    return this.debuts.deletePuzzle(levelId, courseId, moduleId, taskId, puzzleId);
  }

  @Post("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles/:puzzleId/assignments")
  assignPuzzle(
    @Req() req: { user: JwtUserPayload },
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
    @Param("puzzleId") puzzleId: string,
    @Body() dto: AssignPuzzleDto,
  ) {
    return this.debuts.assignPuzzle({
      levelId,
      courseId,
      moduleId,
      taskId,
      puzzleId,
      teacherId: req.user.sub,
      studentId: dto.studentId,
      mode: dto.mode,
      practiceLimit: dto.practiceLimit ?? null,
      dueInHours: dto.dueInHours ?? null,
    });
  }

  @Get("levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles/:puzzleId/assignments")
  listAssignments(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
    @Param("puzzleId") puzzleId: string,
  ) {
    return this.debuts.listPuzzleAssignments({ levelId, courseId, moduleId, taskId, puzzleId });
  }

  @Delete(
    "levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles/:puzzleId/assignments/:assignmentId",
  )
  deleteAssignment(
    @Param("levelId") levelId: string,
    @Param("courseId") courseId: string,
    @Param("moduleId") moduleId: string,
    @Param("taskId") taskId: string,
    @Param("puzzleId") puzzleId: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    return this.debuts.deletePuzzleAssignment({
      levelId,
      courseId,
      moduleId,
      taskId,
      puzzleId,
      assignmentId,
    });
  }
}

