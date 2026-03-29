import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { JwtUserPayload } from "./jwt.types";

@Injectable()
export class TeacherOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    const user = req.user;
    if (!user) return false;
    if (user.type !== "teacher") throw new ForbiddenException("Teacher access required");
    return true;
  }
}

