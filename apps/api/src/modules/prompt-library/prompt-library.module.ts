import { Module } from "@nestjs/common";
import { PromptLibraryController } from "./prompt-library.controller";
import { PromptLibraryRepository } from "./prompt-library.repository";
import { PromptLibraryService } from "./prompt-library.service";
@Module({controllers:[PromptLibraryController],providers:[PromptLibraryRepository,PromptLibraryService]}) export class PromptLibraryModule{}
