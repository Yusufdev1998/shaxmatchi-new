import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeacherOnlyGuard } from "../auth/teacher-only.guard";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("students")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  async listStudents() {
    const students = await this.usersService.listStudents();
    return students.map((s) => ({
      id: s.id,
      login: s.login,
      type: s.type,
      telegramId: s.telegramId ?? null,
      createdAt: s.createdAt,
    }));
  }

  @Post("students")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  async createStudent(@Body() dto: CreateStudentDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const student = await this.usersService.createUser({
      type: "student",
      login: dto.login,
      password: passwordHash,
      telegramId: dto.telegramId?.trim() || null,
    });

    return { id: student.id, login: student.login, type: student.type, telegramId: student.telegramId ?? null };
  }

  @Patch("students/:studentId")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  async updateStudent(@Param("studentId") studentId: string, @Body() dto: UpdateStudentDto) {
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const student = await this.usersService.updateStudent({
      studentId,
      login: dto.login,
      password: passwordHash,
      telegramId: dto.telegramId,
    });
    return {
      id: student.id,
      login: student.login,
      type: student.type,
      telegramId: student.telegramId ?? null,
      createdAt: student.createdAt,
    };
  }

  @Delete("students/:studentId")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  async deleteStudent(@Param("studentId") studentId: string) {
    await this.usersService.deleteStudent(studentId);
    return { ok: true as const };
  }

  /** Returns `https://t.me/<bot>?start=<token>` for the student to open in Telegram (bot links their account). */
  @Post("students/:studentId/telegram-link")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  async issueStudentTelegramLink(@Param("studentId") studentId: string) {
    const { deepLink, expiresAt } = await this.usersService.createStudentTelegramDeepLink(studentId);
    return { deepLink, expiresAt: expiresAt.toISOString() };
  }
}

