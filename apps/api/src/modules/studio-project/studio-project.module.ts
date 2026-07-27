import { Module } from "@nestjs/common";
import { StudioProjectController } from "./studio-project.controller";
import { StudioProjectRepository } from "./studio-project.repository";
import { StudioProjectService } from "./studio-project.service";
@Module({ controllers:[StudioProjectController], providers:[StudioProjectRepository,StudioProjectService], exports:[StudioProjectService] }) export class StudioProjectModule {}
