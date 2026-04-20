import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeacherOnlyGuard } from "../auth/teacher-only.guard";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SettingsService } from "./settings.service";

/** Read-only for any authenticated user; teachers can update. */
@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSettings() {
    return this.settings.getSettings();
  }

  @Patch()
  @UseGuards(TeacherOnlyGuard)
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settings.updateSettings({
      audioAutoplay: dto.audioAutoplay,
      audioDelaySeconds: dto.audioDelaySeconds,
    });
  }
}
