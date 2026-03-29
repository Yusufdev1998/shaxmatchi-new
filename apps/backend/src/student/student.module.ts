import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { StudentDebutsController } from "./student-debuts.controller";
import { StudentDebutsService } from "./student-debuts.service";
import { StudentPuzzlesController } from "./student-puzzles.controller";

@Module({
  imports: [DbModule],
  controllers: [StudentDebutsController, StudentPuzzlesController],
  providers: [StudentDebutsService],
})
export class StudentModule {}

