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
    return students.map((s) => ({ id: s.id, login: s.login, type: s.type, createdAt: s.createdAt }));
  }

  @Post("students")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  async createStudent(@Body() dto: CreateStudentDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const student = await this.usersService.createUser({
      type: "student",
      login: dto.login,
      password: passwordHash,
    });

    return { id: student.id, login: student.login, type: student.type };
  }

  @Patch("students/:studentId")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  async updateStudent(@Param("studentId") studentId: string, @Body() dto: UpdateStudentDto) {
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const student = await this.usersService.updateStudent({
      studentId,
      login: dto.login,
      password: passwordHash,
    });
    return { id: student.id, login: student.login, type: student.type, createdAt: student.createdAt };
  }

  @Delete("students/:studentId")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  async deleteStudent(@Param("studentId") studentId: string) {
    await this.usersService.deleteStudent(studentId);
    return { ok: true as const };
  }
}

