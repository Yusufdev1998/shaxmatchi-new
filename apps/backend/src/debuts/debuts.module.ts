import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { DebutsController } from "./debuts.controller";
import { DebutsService } from "./debuts.service";

@Module({
  imports: [DbModule],
  controllers: [DebutsController],
  providers: [DebutsService],
})
export class DebutsModule {}

