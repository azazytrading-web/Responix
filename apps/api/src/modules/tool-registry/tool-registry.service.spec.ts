import { ToolRegistryService } from "./tool-registry.service";

describe("ToolRegistryService", () => {
  const repository = {
    createCategory: jest.fn(), updateCategory: jest.fn(), listCategories: jest.fn(), deleteCategory: jest.fn(),
    createGroup: jest.fn(), updateGroup: jest.fn(), listGroups: jest.fn(), deleteGroup: jest.fn(),
    create: jest.fn(), updateDraft: jest.fn(), publish: jest.fn(), rollback: jest.fn(),
    clone: jest.fn(), archive: jest.fn(), restore: jest.fn(), softDelete: jest.fn(),
    get: jest.fn(), history: jest.fn(), list: jest.fn()
  };
  const service = new ToolRegistryService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("workspace-scopes taxonomy and tool drafts", async () => {
    await service.createCategory("workspace","actor",{name:"CRM",slug:"crm"});
    await service.createGroup("workspace","actor",{name:"Contacts",slug:"contacts",categoryId:"category"});
    await service.create("workspace","actor",{name:"Lookup",slug:"lookup",type:"REST"});
    expect(repository.createCategory).toHaveBeenCalledWith("workspace","actor",{name:"CRM",slug:"crm"});
    expect(repository.createGroup).toHaveBeenCalledWith("workspace","actor",{name:"Contacts",slug:"contacts",categoryId:"category"});
    expect(repository.create).toHaveBeenCalledWith("workspace","actor",{name:"Lookup",slug:"lookup",type:"REST"});
  });

  it("delegates the complete lifecycle", async () => {
    await service.publish("workspace","actor","tool","Ready");
    await service.rollback("workspace","actor","tool",{revision:1});
    await service.clone("workspace","actor","tool",{name:"Copy",slug:"copy"});
    await service.archive("workspace","actor","tool");
    await service.restore("workspace","actor","tool");
    await service.delete("workspace","actor","tool");
    expect(repository.publish).toHaveBeenCalledWith("workspace","actor","tool","Ready");
    expect(repository.rollback).toHaveBeenCalledWith("workspace","actor","tool",1,undefined);
    expect(repository.clone).toHaveBeenCalledWith("workspace","actor","tool","Copy","copy");
    expect(repository.archive).toHaveBeenCalledWith("workspace","actor","tool");
    expect(repository.restore).toHaveBeenCalledWith("workspace","actor","tool");
    expect(repository.softDelete).toHaveBeenCalledWith("workspace","actor","tool");
  });

  it("normalizes list pagination and preserves metadata filters", async () => {
    await service.list("workspace",{search:"lookup",type:"REST",visibility:"PRIVATE",categoryId:"category"});
    expect(repository.list).toHaveBeenCalledWith({
      workspaceId:"workspace",page:1,limit:25,search:"lookup",status:undefined,type:"REST",
      visibility:"PRIVATE",categoryId:"category",groupId:undefined
    });
  });
});
