/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ToolRegistryRepository } from "./tool-registry.repository";

const category={id:"category",workspaceId:"workspace",name:"CRM",slug:"crm",description:null,metadata:{},createdAt:new Date(),updatedAt:new Date()};
const group={id:"group",workspaceId:"workspace",categoryId:"category",name:"Contacts",slug:"contacts",description:null,metadata:{},createdAt:new Date(),updatedAt:new Date()};
const parameter={id:"parameter",name:"id",location:"PATH",required:true,schema:{type:"string"},metadata:{},sortOrder:0,createdAt:new Date(),updatedAt:new Date()};
const schema={id:"schema",kind:"INPUT",schema:{type:"object"},metadata:{},createdAt:new Date(),updatedAt:new Date()};
const capability={id:"capability",code:"contacts.read",enabled:true,metadata:{},createdAt:new Date(),updatedAt:new Date()};
const permission={id:"permission",permissionCode:"crm.view",metadata:{},createdAt:new Date(),updatedAt:new Date()};
const tool=(overrides:Record<string,unknown>={})=>({
  id:"tool",workspaceId:"workspace",categoryId:"category",groupId:"group",name:"Lookup",
  slug:"lookup",description:"Lookup contact",type:"REST",status:"DRAFT",visibility:"WORKSPACE",
  authenticationType:"API_KEY",revision:0,metadata:{},providerMetadata:{endpoint:"https://api.example.com/{id}"},
  authenticationMetadata:{headerName:"x-api-key"},rateLimitMetadata:{},executionPolicyMetadata:{},
  timeoutMetadata:{milliseconds:5000},retryPolicyMetadata:{},costMetadata:{},
  compatibilityMetadata:{versions:["v1"]},healthMetadata:{},mcpMetadata:{},
  createdById:"actor",updatedById:"actor",createdAt:new Date(),updatedAt:new Date(),
  archivedAt:null,deletedAt:null,parameters:[parameter],schemas:[schema],
  capabilities:[capability],permissions:[permission],...overrides
});

describe("ToolRegistryRepository",()=>{
  const prisma={
    toolCategory:{create:jest.fn(),update:jest.fn(),delete:jest.fn(),findFirst:jest.fn(),findMany:jest.fn()},
    toolGroup:{create:jest.fn(),update:jest.fn(),delete:jest.fn(),findFirst:jest.fn(),findMany:jest.fn(),count:jest.fn()},
    toolDefinition:{create:jest.fn(),update:jest.fn(),findFirst:jest.fn(),findMany:jest.fn(),count:jest.fn()},
    toolVersion:{create:jest.fn(),findFirst:jest.fn(),findMany:jest.fn()},
    permission:{count:jest.fn()},
    auditLog:{create:jest.fn()},
    $transaction:jest.fn()
  };
  const repository=new ToolRegistryRepository(prisma as never);

  beforeEach(()=>{
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async(input:unknown)=>{
      if(Array.isArray(input))return Promise.all(input);
      return (input as(tx:typeof prisma)=>unknown)(prisma);
    });
    prisma.toolCategory.findFirst.mockResolvedValue(category);
    prisma.toolGroup.findFirst.mockResolvedValue(group);
    prisma.toolDefinition.findFirst.mockResolvedValue(tool());
    prisma.toolDefinition.create.mockResolvedValue(tool());
    prisma.toolDefinition.update.mockResolvedValue(tool());
    prisma.permission.count.mockResolvedValue(1);
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("creates normalized metadata children and audits atomically",async()=>{
    await repository.create("workspace","actor",draft());
    expect(prisma.toolDefinition.create).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({
        workspaceId:"workspace",categoryId:"category",groupId:"group",status:"DRAFT",revision:0,
        providerMetadata:{endpoint:"https://api.example.com/{id}"},
        parameters:{create:[expect.objectContaining({name:"id",location:"PATH"})]},
        schemas:{create:[expect.objectContaining({kind:"INPUT"})]},
        capabilities:{create:[expect.objectContaining({code:"contacts.read"})]},
        permissions:{create:[expect.objectContaining({permissionCode:"crm.view"})]}
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({action:"tool.definition.created",workspaceId:"workspace"})
    }));
  });

  it("rejects cross-workspace categories and groups",async()=>{
    prisma.toolCategory.findFirst.mockResolvedValue(null);
    await expect(repository.create("workspace","actor",draft())).rejects.toBeInstanceOf(NotFoundException);
    prisma.toolCategory.findFirst.mockResolvedValue(category);
    prisma.toolGroup.findFirst.mockResolvedValue({...group,categoryId:"other"});
    await expect(repository.create("workspace","actor",draft())).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects duplicate children and unknown permission requirements",async()=>{
    const duplicate=draft();
    duplicate.parameters=[duplicate.parameters[0]!,duplicate.parameters[0]!];
    await expect(repository.create("workspace","actor",duplicate)).rejects.toBeInstanceOf(BadRequestException);
    prisma.permission.count.mockResolvedValue(0);
    await expect(repository.create("workspace","actor",draft())).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enforces draft-only editing",async()=>{
    prisma.toolDefinition.findFirst.mockResolvedValue(tool({status:"PUBLISHED",revision:1}));
    await expect(repository.updateDraft("workspace","actor","tool",{description:"Changed"}))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.toolDefinition.update).not.toHaveBeenCalled();
  });

  it("validates publish business metadata and creates immutable version",async()=>{
    prisma.toolVersion.create.mockResolvedValue({id:"version",toolId:"tool",revision:1});
    prisma.toolDefinition.update.mockResolvedValue(tool({status:"PUBLISHED",revision:1}));
    await repository.publish("workspace","actor","tool","Ready");
    expect(prisma.toolVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({
        toolId:"tool",revision:1,changeSummary:"Ready",
        snapshot:expect.objectContaining({
          providerMetadata:{endpoint:"https://api.example.com/{id}"},
          parameters:[expect.objectContaining({name:"id"})],
          schemas:[expect.objectContaining({kind:"INPUT"})],
          permissions:[expect.objectContaining({permissionCode:"crm.view"})]
        })
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({action:"tool.definition.published"})
    }));
  });

  it("rejects publish without input schema or required provider/auth metadata",async()=>{
    prisma.toolDefinition.findFirst.mockResolvedValue(tool({schemas:[]}));
    await expect(repository.publish("workspace","actor","tool")).rejects.toBeInstanceOf(BadRequestException);
    prisma.toolDefinition.findFirst.mockResolvedValue(tool({providerMetadata:{}}));
    await expect(repository.publish("workspace","actor","tool")).rejects.toBeInstanceOf(BadRequestException);
    prisma.toolDefinition.findFirst.mockResolvedValue(tool({authenticationMetadata:{}}));
    await expect(repository.publish("workspace","actor","tool")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rollback creates a new published revision and replaces normalized metadata",async()=>{
    prisma.toolDefinition.findFirst.mockResolvedValue(tool({status:"PUBLISHED",revision:2}));
    prisma.toolVersion.findFirst.mockResolvedValue({id:"source",toolId:"tool",revision:1,snapshot:snapshot()});
    prisma.toolVersion.create.mockResolvedValue({id:"new",revision:3});
    await repository.rollback("workspace","actor","tool",1);
    expect(prisma.toolVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({revision:3,changeSummary:"Rollback to revision 1"})
    }));
    expect(prisma.toolDefinition.update).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({
        status:"PUBLISHED",revision:3,
        parameters:expect.objectContaining({deleteMany:{}}),
        schemas:expect.objectContaining({deleteMany:{}}),
        capabilities:expect.objectContaining({deleteMany:{}}),
        permissions:expect.objectContaining({deleteMany:{}})
      })
    }));
  });

  it("clone creates independent child ids and no versions",async()=>{
    prisma.toolDefinition.create.mockResolvedValue(tool({id:"clone",name:"Copy",slug:"copy"}));
    await repository.clone("workspace","actor","tool","Copy","copy");
    expect(prisma.toolDefinition.create).toHaveBeenCalledWith(expect.objectContaining({
      data:expect.objectContaining({
        name:"Copy",slug:"copy",status:"DRAFT",revision:0,
        parameters:{create:[expect.not.objectContaining({id:"parameter"})]},
        schemas:{create:[expect.not.objectContaining({id:"schema"})]}
      })
    }));
    expect(prisma.toolVersion.create).not.toHaveBeenCalled();
  });

  it("archives, restores, and soft-deletes without deleting versions",async()=>{
    prisma.toolDefinition.findFirst
      .mockResolvedValueOnce(tool({status:"PUBLISHED",revision:2}))
      .mockResolvedValueOnce(tool({status:"ARCHIVED",revision:2,archivedAt:new Date()}))
      .mockResolvedValueOnce(tool({status:"PUBLISHED",revision:2}));
    await repository.archive("workspace","actor","tool");
    await repository.restore("workspace","actor","tool");
    await repository.softDelete("workspace","actor","tool");
    expect(prisma.toolDefinition.update).toHaveBeenNthCalledWith(1,expect.objectContaining({
      data:expect.objectContaining({status:"ARCHIVED",archivedAt:expect.any(Date)})
    }));
    expect(prisma.toolDefinition.update).toHaveBeenNthCalledWith(2,expect.objectContaining({
      data:expect.objectContaining({status:"PUBLISHED",archivedAt:null,deletedAt:null})
    }));
    expect(prisma.toolDefinition.update).toHaveBeenNthCalledWith(3,expect.objectContaining({
      data:expect.objectContaining({status:"ARCHIVED",deletedAt:expect.any(Date)})
    }));
    expect(prisma.toolVersion.create).not.toHaveBeenCalled();
  });

  it("protects taxonomy in use and rolls back audit failures",async()=>{
    prisma.toolDefinition.count.mockResolvedValue(1);
    prisma.toolGroup.count.mockResolvedValue(0);
    await expect(repository.deleteCategory("workspace","actor","category")).rejects.toBeInstanceOf(ConflictException);
    const failure=new Error("audit unavailable");
    prisma.auditLog.create.mockRejectedValue(failure);
    await expect(repository.archive("workspace","actor","tool")).rejects.toBe(failure);
  });
});

function draft(){
  return {
    name:"Lookup",slug:"lookup",description:"Lookup contact",type:"REST" as const,
    categoryId:"category",groupId:"group",authenticationType:"API_KEY" as const,
    metadata:{
      provider:{endpoint:"https://api.example.com/{id}"},
      authentication:{headerName:"x-api-key"},timeout:{milliseconds:5000},
      compatibility:{versions:["v1"]}
    },
    parameters:[{name:"id",location:"PATH" as const,required:true,schema:{type:"string"}}],
    schemas:[{kind:"INPUT" as const,schema:{type:"object"}}],
    capabilities:[{code:"contacts.read"}],
    permissions:[{permissionCode:"crm.view"}]
  };
}
function snapshot(){
  return {
    categoryId:"category",groupId:"group",name:"Lookup",slug:"lookup",description:"Lookup",
    type:"REST",visibility:"WORKSPACE",authenticationType:"API_KEY",metadata:{},
    providerMetadata:{endpoint:"https://api.example.com/{id}"},
    authenticationMetadata:{headerName:"x-api-key"},rateLimitMetadata:{},
    executionPolicyMetadata:{},timeoutMetadata:{},retryPolicyMetadata:{},costMetadata:{},
    compatibilityMetadata:{versions:["v1"]},healthMetadata:{},mcpMetadata:{},
    parameters:[{name:"id",location:"PATH",required:true,schema:{type:"string"},metadata:{},sortOrder:0}],
    schemas:[{kind:"INPUT",schema:{type:"object"},metadata:{}}],
    capabilities:[{code:"contacts.read",enabled:true,metadata:{}}],
    permissions:[{permissionCode:"crm.view",metadata:{}}]
  };
}
