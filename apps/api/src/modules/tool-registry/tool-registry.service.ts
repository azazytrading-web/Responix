import { Injectable } from "@nestjs/common";
import { ToolRegistryRepository } from "./tool-registry.repository";
import type {
  CloneToolDefinitionDto,
  CreateToolDefinitionDto,
  CreateToolGroupDto,
  RollbackToolDefinitionDto,
  ToolDefinitionListQueryDto,
  ToolTaxonomyDto,
  UpdateToolDefinitionDto,
  UpdateToolGroupDto,
  UpdateToolTaxonomyDto
} from "./dto/tool-registry.dto";

@Injectable()
export class ToolRegistryService {
  constructor(private readonly repository: ToolRegistryRepository) {}

  createCategory(w:string,a:string,d:ToolTaxonomyDto){return this.repository.createCategory(w,a,d);}
  updateCategory(w:string,a:string,id:string,d:UpdateToolTaxonomyDto){return this.repository.updateCategory(w,a,id,d);}
  listCategories(w:string){return this.repository.listCategories(w);}
  deleteCategory(w:string,a:string,id:string){return this.repository.deleteCategory(w,a,id);}
  createGroup(w:string,a:string,d:CreateToolGroupDto){return this.repository.createGroup(w,a,d);}
  updateGroup(w:string,a:string,id:string,d:UpdateToolGroupDto){return this.repository.updateGroup(w,a,id,d);}
  listGroups(w:string,categoryId?:string){return this.repository.listGroups(w,categoryId);}
  deleteGroup(w:string,a:string,id:string){return this.repository.deleteGroup(w,a,id);}
  create(w:string,a:string,d:CreateToolDefinitionDto){return this.repository.create(w,a,d);}
  updateDraft(w:string,a:string,id:string,d:UpdateToolDefinitionDto){return this.repository.updateDraft(w,a,id,d);}
  publish(w:string,a:string,id:string,summary?:string){return this.repository.publish(w,a,id,summary);}
  rollback(w:string,a:string,id:string,d:RollbackToolDefinitionDto){return this.repository.rollback(w,a,id,d.revision,d.changeSummary);}
  clone(w:string,a:string,id:string,d:CloneToolDefinitionDto){return this.repository.clone(w,a,id,d.name,d.slug);}
  archive(w:string,a:string,id:string){return this.repository.archive(w,a,id);}
  restore(w:string,a:string,id:string){return this.repository.restore(w,a,id);}
  delete(w:string,a:string,id:string){return this.repository.softDelete(w,a,id);}
  get(w:string,id:string){return this.repository.get(w,id);}
  history(w:string,id:string){return this.repository.history(w,id);}
  list(w:string,q:ToolDefinitionListQueryDto){return this.repository.list({
    workspaceId:w,page:q.page??1,limit:q.limit??25,search:q.search,status:q.status,type:q.type,
    visibility:q.visibility,categoryId:q.categoryId,groupId:q.groupId
  });}
}
