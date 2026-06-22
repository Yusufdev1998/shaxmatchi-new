import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeacherOnlyGuard } from "../auth/teacher-only.guard";
import type { JwtUserPayload } from "../auth/jwt.types";
import { SubscribeDto, UnsubscribeDto } from "./push.dto";
import { PushService } from "./push.service";

@Controller("admin/push")
@UseGuards(JwtAuthGuard, TeacherOnlyGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get("public-key")
  publicKey() {
    return { publicKey: this.push.getPublicKey(), enabled: this.push.isConfigured() };
  }

  @Post("subscribe")
  async subscribe(@Req() req: { user: JwtUserPayload }, @Body() dto: SubscribeDto) {
    await this.push.saveSubscription(req.user.sub, dto.subscription, dto.userAgent);
    return { ok: true };
  }

  @Post("unsubscribe")
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    await this.push.removeSubscription(dto.endpoint);
    return { ok: true };
  }
}
