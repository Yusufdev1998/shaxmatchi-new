import { Type } from "class-transformer";
import {
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";

class PushSubscriptionKeysDto {
  @IsString()
  @MinLength(1)
  p256dh!: string;

  @IsString()
  @MinLength(1)
  auth!: string;
}

class PushSubscriptionObjectDto {
  @IsString()
  @MinLength(1)
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}

export class SubscribeDto {
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionObjectDto)
  subscription!: PushSubscriptionObjectDto;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class UnsubscribeDto {
  @IsString()
  @MinLength(1)
  endpoint!: string;
}
