import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeacherOnlyGuard } from "../auth/teacher-only.guard";
import { AdminStatsService } from "./admin-stats.service";

/**
 * Admin statistikalar. Har bir stat turini alohida endpoint yoki umumiy ob'ekt orqali kengaytirish mumkin.
 */
@Controller("admin/stats")
@UseGuards(JwtAuthGuard, TeacherOnlyGuard)
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get("learning-puzzles")
  listLearningPuzzles() {
    return this.stats.listLearningPuzzleStats();
  }

  @Get("practice-puzzles")
  listPracticePuzzles() {
    return this.stats.listPracticePuzzleStats();
  }
}
