import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { StudentDebutsController } from "./student-debuts.controller";
import { StudentDebutsService } from "./student-debuts.service";
import { StudentExamsController } from "./student-exams.controller";
import { StudentExamsService } from "./student-exams.service";
import { StudentPuzzlesController } from "./student-puzzles.controller";

@Module({
  imports: [DbModule],
  controllers: [StudentDebutsController, StudentPuzzlesController, StudentExamsController],
  providers: [StudentDebutsService, StudentExamsService],
})
export class StudentModule {}

