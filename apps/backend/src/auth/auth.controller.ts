import { Body, Controller, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { BootstrapTeacherDto } from "./dto/bootstrap-teacher.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { JwtUserPayload } from "./jwt.types";
import { TeacherOnlyGuard } from "./teacher-only.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // One-time endpoint to create the first teacher account.
  @Post("bootstrap-teacher")
  bootstrapTeacher(@Body() dto: BootstrapTeacherDto) {
    return this.authService.bootstrapTeacher(dto);
  }

  @Patch("password")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  changePassword(@Req() req: { user: JwtUserPayload }, @Body() dto: ChangePasswordDto) {
    return this.authService.changeTeacherPassword(req.user.sub, dto);
  }
}

