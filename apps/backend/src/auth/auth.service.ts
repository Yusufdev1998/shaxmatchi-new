import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { UsersService } from "../users/users.service";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { LoginDto } from "./dto/login.dto";
import type { BootstrapTeacherDto } from "./dto/bootstrap-teacher.dto";
import type { JwtUserPayload } from "./jwt.types";
import type { TelegramLoginDto } from "./dto/telegram-login.dto";

function toPublicUser(user: { id: string; login: string; type: "student" | "teacher" }) {
  return { id: user.id, login: user.login, type: user.type };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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

    const signOptions = user.type === "student" ? { expiresIn: "100y" } : {};
    const accessToken = await this.jwt.signAsync(payload, signOptions);
    return { accessToken, user: toPublicUser({ id: user.id, login: user.login, type: user.type }) };
  }

  async telegramLogin(dto: TelegramLoginDto) {
    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!botToken) throw new ForbiddenException("Telegram auth is not configured");

    const params = new URLSearchParams(dto.initData);
    const incomingHash = params.get("hash");
    const authDateRaw = params.get("auth_date");
    const userRaw = params.get("user");
    if (!incomingHash || !authDateRaw || !userRaw) {
      throw new UnauthorizedException("Invalid Telegram init data");
    }

    const entries = [...params.entries()].filter(([key]) => key !== "hash").sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join("\n");
    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = createHmac("sha256", secret).update(dataCheckString).digest("hex");

    const incomingHashBuffer = Buffer.from(incomingHash, "hex");
    const calculatedHashBuffer = Buffer.from(calculatedHash, "hex");
    if (
      incomingHashBuffer.length !== calculatedHashBuffer.length ||
      !timingSafeEqual(incomingHashBuffer, calculatedHashBuffer)
    ) {
      throw new UnauthorizedException("Invalid Telegram signature");
    }

    const authDate = Number(authDateRaw);
    if (!Number.isFinite(authDate)) throw new UnauthorizedException("Invalid Telegram auth date");
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - authDate) > 60 * 60 * 24) {
      throw new UnauthorizedException("Telegram auth has expired");
    }

    let telegramUser: { id: number; username?: string };
    try {
      telegramUser = JSON.parse(userRaw) as { id: number; username?: string };
    } catch {
      throw new UnauthorizedException("Invalid Telegram user payload");
    }

    const telegramId = String(telegramUser.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) throw new UnauthorizedException("Telegram account is not linked");
    if (user.type !== "student") throw new ForbiddenException("Student access required");

    const payload: JwtUserPayload = {
      sub: user.id,
      login: user.login,
      type: user.type,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: "100y" });
    return {
      accessToken,
      user: toPublicUser({ id: user.id, login: user.login, type: user.type }),
    };
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
