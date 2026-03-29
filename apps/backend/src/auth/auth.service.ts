import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { UsersService } from "../users/users.service";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { LoginDto } from "./dto/login.dto";
import type { BootstrapTeacherDto } from "./dto/bootstrap-teacher.dto";
import type { JwtUserPayload } from "./jwt.types";

function toPublicUser(user: { id: string; login: string; type: "student" | "teacher" }) {
  return { id: user.id, login: user.login, type: user.type };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByLogin(dto.login);
    if (!user) throw new UnauthorizedException("Invalid login or password");

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException("Invalid login or password");

    const payload: JwtUserPayload = {
      sub: user.id,
      login: user.login,
      type: user.type,
    };

    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: toPublicUser({ id: user.id, login: user.login, type: user.type }) };
  }

  async bootstrapTeacher(dto: BootstrapTeacherDto) {
    const teacherCount = await this.usersService.countTeachers();
    if (teacherCount > 0) throw new ConflictException("Teacher already exists");

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const teacher = await this.usersService.createUser({
      type: "teacher",
      login: dto.login,
      password: passwordHash,
    });

    const payload: JwtUserPayload = {
      sub: teacher.id,
      login: teacher.login,
      type: "teacher",
    };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: toPublicUser({ id: teacher.id, login: teacher.login, type: "teacher" }) };
  }

  async changeTeacherPassword(teacherId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(teacherId);
    if (!user) throw new UnauthorizedException("Invalid session");
    if (user.type !== "teacher") throw new ForbiddenException("Teacher access required");

    const ok = await bcrypt.compare(dto.oldPassword, user.password);
    if (!ok) throw new UnauthorizedException("Current password is incorrect");

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.setPasswordForUser(teacherId, passwordHash);
    return { ok: true as const };
  }
}
