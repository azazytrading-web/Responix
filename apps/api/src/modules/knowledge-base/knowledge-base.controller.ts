import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Version } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import { KnowledgeBaseService } from "./knowledge-base.service";
import {
  CloneKnowledgeDocumentDto,
  CreateKnowledgeCollectionDto,
  CreateKnowledgeDocumentDto,
  CreateKnowledgeFolderDto,
  CreateKnowledgeSpaceDto,
  KnowledgeDocumentListQueryDto,
  KnowledgeNamedDto,
  PublishKnowledgeDocumentDto,
  RollbackKnowledgeDocumentDto,
  UpdateKnowledgeCollectionDto,
  UpdateKnowledgeDocumentDto,
  UpdateKnowledgeFolderDto,
  UpdateKnowledgeNamedDto,
  UpdateKnowledgeSpaceDto
} from "./dto/knowledge-base.dto";

@ApiTags("Knowledge Base")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active membership and endpoint-specific Knowledge Base permission are required" })
@ApiNotFoundResponse({ description: "Knowledge resource was not found in the active workspace" })
@Controller("knowledge-base")
export class KnowledgeBaseController {
  constructor(private readonly service: KnowledgeBaseService) {}

  @Get("spaces") @Version("1") @Permissions("knowledge.base.read") @ApiOperation({ summary: "List knowledge spaces" })
  spaces(@Req() r: TenantRequest) { return this.service.listSpaces(r.tenantContext!.workspace.id); }
  @Post("spaces") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Create a knowledge space" })
  createSpace(@Req() r: TenantRequest, @Body() dto: CreateKnowledgeSpaceDto) { const c=r.tenantContext!; return this.service.createSpace(c.workspace.id,c.user.id,dto); }
  @Put("spaces/:id") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Update a knowledge space" })
  updateSpace(@Req() r: TenantRequest,@Param("id")id:string,@Body()dto:UpdateKnowledgeSpaceDto){const c=r.tenantContext!;return this.service.updateSpace(c.workspace.id,c.user.id,id,dto);}
  @Delete("spaces/:id") @Version("1") @Permissions("knowledge.base.delete") @ApiConflictResponse({description:"Knowledge space must be empty"}) @ApiOperation({ summary: "Soft-delete an empty knowledge space" })
  deleteSpace(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.deleteSpace(c.workspace.id,c.user.id,id);}

  @Get("collections") @Version("1") @Permissions("knowledge.base.read") @ApiOperation({ summary: "List knowledge collections" })
  collections(@Req()r:TenantRequest,@Query("spaceId")spaceId?:string){return this.service.listCollections(r.tenantContext!.workspace.id,spaceId);}
  @Post("collections") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Create a knowledge collection" })
  createCollection(@Req()r:TenantRequest,@Body()dto:CreateKnowledgeCollectionDto){const c=r.tenantContext!;return this.service.createCollection(c.workspace.id,c.user.id,dto);}
  @Put("collections/:id") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Update a knowledge collection" })
  updateCollection(@Req()r:TenantRequest,@Param("id")id:string,@Body()dto:UpdateKnowledgeCollectionDto){const c=r.tenantContext!;return this.service.updateCollection(c.workspace.id,c.user.id,id,dto);}
  @Delete("collections/:id") @Version("1") @Permissions("knowledge.base.delete") @ApiOperation({ summary: "Soft-delete an empty knowledge collection" })
  deleteCollection(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.deleteCollection(c.workspace.id,c.user.id,id);}

  @Get("folders") @Version("1") @Permissions("knowledge.base.read") @ApiOperation({ summary: "List knowledge folders" })
  folders(@Req()r:TenantRequest,@Query("spaceId")spaceId?:string,@Query("collectionId")collectionId?:string){return this.service.listFolders(r.tenantContext!.workspace.id,spaceId,collectionId);}
  @Post("folders") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Create a knowledge folder" })
  createFolder(@Req()r:TenantRequest,@Body()dto:CreateKnowledgeFolderDto){const c=r.tenantContext!;return this.service.createFolder(c.workspace.id,c.user.id,dto);}
  @Put("folders/:id") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Update a knowledge folder and validate hierarchy" })
  updateFolder(@Req()r:TenantRequest,@Param("id")id:string,@Body()dto:UpdateKnowledgeFolderDto){const c=r.tenantContext!;return this.service.updateFolder(c.workspace.id,c.user.id,id,dto);}
  @Delete("folders/:id") @Version("1") @Permissions("knowledge.base.delete") @ApiOperation({ summary: "Soft-delete an empty knowledge folder" })
  deleteFolder(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.deleteFolder(c.workspace.id,c.user.id,id);}

  @Get("categories") @Version("1") @Permissions("knowledge.base.read") @ApiOperation({ summary: "List knowledge categories" })
  categories(@Req()r:TenantRequest){return this.service.listCategories(r.tenantContext!.workspace.id);}
  @Post("categories") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Create a knowledge category" })
  createCategory(@Req()r:TenantRequest,@Body()dto:KnowledgeNamedDto){const c=r.tenantContext!;return this.service.createCategory(c.workspace.id,c.user.id,dto);}
  @Put("categories/:id") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Update a knowledge category" })
  updateCategory(@Req()r:TenantRequest,@Param("id")id:string,@Body()dto:UpdateKnowledgeNamedDto){const c=r.tenantContext!;return this.service.updateCategory(c.workspace.id,c.user.id,id,dto);}
  @Delete("categories/:id") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Delete an unused knowledge category" })
  deleteCategory(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.deleteCategory(c.workspace.id,c.user.id,id);}

  @Get("tags") @Version("1") @Permissions("knowledge.base.read") @ApiOperation({ summary: "List knowledge tags" })
  tags(@Req()r:TenantRequest){return this.service.listTags(r.tenantContext!.workspace.id);}
  @Post("tags") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Create a knowledge tag" })
  createTag(@Req()r:TenantRequest,@Body()dto:KnowledgeNamedDto){const c=r.tenantContext!;return this.service.createTag(c.workspace.id,c.user.id,dto);}
  @Put("tags/:id") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Update a knowledge tag" })
  updateTag(@Req()r:TenantRequest,@Param("id")id:string,@Body()dto:UpdateKnowledgeNamedDto){const c=r.tenantContext!;return this.service.updateTag(c.workspace.id,c.user.id,id,dto);}
  @Delete("tags/:id") @Version("1") @Permissions("knowledge.base.manage") @ApiOperation({ summary: "Delete an unused knowledge tag" })
  deleteTag(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.deleteTag(c.workspace.id,c.user.id,id);}

  @Get("documents") @Version("1") @Permissions("knowledge.base.read") @ApiOperation({ summary: "Search and paginate knowledge document metadata" })
  documents(@Req()r:TenantRequest,@Query()query:KnowledgeDocumentListQueryDto){return this.service.listDocuments(r.tenantContext!.workspace.id,query);}
  @Get("documents/:id") @Version("1") @Permissions("knowledge.base.read") @ApiOperation({ summary: "Get a knowledge document" })
  document(@Req()r:TenantRequest,@Param("id")id:string){return this.service.getDocument(r.tenantContext!.workspace.id,id);}
  @Get("documents/:id/history") @Version("1") @Permissions("knowledge.base.read") @ApiOperation({ summary: "Get immutable knowledge document history" })
  history(@Req()r:TenantRequest,@Param("id")id:string){return this.service.history(r.tenantContext!.workspace.id,id);}
  @Post("documents") @Version("1") @Permissions("knowledge.base.write") @ApiBadRequestResponse({description:"Document hierarchy or metadata is invalid"}) @ApiOperation({ summary: "Create a knowledge document draft" })
  createDocument(@Req()r:TenantRequest,@Body()dto:CreateKnowledgeDocumentDto){const c=r.tenantContext!;return this.service.createDocument(c.workspace.id,c.user.id,dto);}
  @Put("documents/:id") @Version("1") @Permissions("knowledge.base.write") @ApiOperation({ summary: "Update knowledge document draft metadata" })
  updateDocument(@Req()r:TenantRequest,@Param("id")id:string,@Body()dto:UpdateKnowledgeDocumentDto){const c=r.tenantContext!;return this.service.updateDocument(c.workspace.id,c.user.id,id,dto);}
  @Post("documents/:id/publish") @Version("1") @Permissions("knowledge.base.publish") @ApiOperation({ summary: "Publish an immutable knowledge document revision" })
  publish(@Req()r:TenantRequest,@Param("id")id:string,@Body()dto:PublishKnowledgeDocumentDto){const c=r.tenantContext!;return this.service.publishDocument(c.workspace.id,c.user.id,id,dto.changeSummary);}
  @Post("documents/:id/rollback") @Version("1") @Permissions("knowledge.base.rollback") @ApiOperation({ summary: "Create a new published revision from prior knowledge metadata" })
  rollback(@Req()r:TenantRequest,@Param("id")id:string,@Body()dto:RollbackKnowledgeDocumentDto){const c=r.tenantContext!;return this.service.rollbackDocument(c.workspace.id,c.user.id,id,dto);}
  @Post("documents/:id/clone") @Version("1") @Permissions("knowledge.base.write") @ApiOperation({ summary: "Clone a knowledge document into an independent draft" })
  clone(@Req()r:TenantRequest,@Param("id")id:string,@Body()dto:CloneKnowledgeDocumentDto){const c=r.tenantContext!;return this.service.cloneDocument(c.workspace.id,c.user.id,id,dto);}
  @Post("documents/:id/archive") @Version("1") @Permissions("knowledge.base.archive") @ApiOperation({ summary: "Archive a knowledge document while retaining history" })
  archive(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.archiveDocument(c.workspace.id,c.user.id,id);}
  @Post("documents/:id/restore") @Version("1") @Permissions("knowledge.base.archive") @ApiOperation({ summary: "Restore an archived or soft-deleted knowledge document" })
  restore(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.restoreDocument(c.workspace.id,c.user.id,id);}
  @Delete("documents/:id") @Version("1") @Permissions("knowledge.base.delete") @ApiOperation({ summary: "Soft-delete a knowledge document without removing versions" })
  deleteDocument(@Req()r:TenantRequest,@Param("id")id:string){const c=r.tenantContext!;return this.service.deleteDocument(c.workspace.id,c.user.id,id);}
}
