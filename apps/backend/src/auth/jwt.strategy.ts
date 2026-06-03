import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsersService } from "../users/users.service";
import type { JwtUserPayload } from "./jwt.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret) {
      // Fail fast: auth cannot work without a signing secret
      throw new UnauthorizedException("JWT_SECRET is not configured");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtUserPayload): Promise<JwtUserPayload> {
    // The user can be deleted (and recreated with a new id) while a long-lived
    // token is still cached client-side. Reject tokens whose subject no longer
    // exists, or whose role changed, so the client is forced to re-authenticate.
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException("User no longer exists");
    if (user.type !== payload.type) throw new UnauthorizedException("User role changed");
    return payload;
  }
}

