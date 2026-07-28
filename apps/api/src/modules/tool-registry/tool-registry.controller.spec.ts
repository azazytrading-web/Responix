import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ToolRegistryController } from "./tool-registry.controller";
import {
  CreateToolDefinitionDto,
  RollbackToolDefinitionDto,
  ToolDefinitionListQueryDto
} from "./dto/tool-registry.dto";

describe("ToolRegistryController validation and permissions", () => {
  const pipe = new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});

  it("accepts complete REST, auth, policy, schema, and parameter metadata", async () => {
    await expect(pipe.transform({
      name:"Contact Lookup",slug:"contact-lookup",type:"REST",visibility:"WORKSPACE",
      authenticationType:"API_KEY",
      metadata:{
        provider:{endpoint:"https://api.example.com/contacts/{id}",method:"GET"},
        authentication:{headerName:"x-api-key"},
        rateLimit:{requests:100,windowSeconds:60},
        executionPolicy:{allowedMethods:["GET"]},
        timeout:{milliseconds:5000},retryPolicy:{maxAttempts:3},
        cost:{unit:"request",amount:0.01},compatibility:{versions:["v1"]},
        health:{path:"/health"},mcp:{server:"crm"}
      },
      parameters:[{name:"id",location:"PATH",required:true,schema:{type:"string"}}],
      schemas:[
        {kind:"INPUT",schema:{type:"object"}},
        {kind:"OUTPUT",schema:{type:"object"}}
      ],
      capabilities:[{code:"contacts.read"}],
      permissions:[{permissionCode:"crm.view"}]
    },{type:"body",metatype:CreateToolDefinitionDto})).resolves.toBeInstanceOf(CreateToolDefinitionDto);
  });

  it.each([
    {name:"Bad",slug:"Bad Slug",type:"REST"},
    {name:"Bad",slug:"bad",type:"UNKNOWN"},
    {name:"Bad",slug:"bad",type:"REST",parameters:[{name:"bad name",location:"QUERY",schema:{}}]},
    {name:"Bad",slug:"bad",type:"REST",schemas:[{kind:"UNKNOWN",schema:{}}]}
  ])("rejects invalid registry payload %#",async(payload)=>{
    await expect(pipe.transform(payload,{type:"body",metatype:CreateToolDefinitionDto}))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates rollback and transforms pagination",async()=>{
    await expect(pipe.transform({revision:0},{type:"body",metatype:RollbackToolDefinitionDto}))
      .rejects.toBeInstanceOf(BadRequestException);
    const query=await pipe.transform({page:"2",limit:"50",status:"PUBLISHED",type:"MCP"},
      {type:"query",metatype:ToolDefinitionListQueryDto}) as ToolDefinitionListQueryDto;
    expect(query).toMatchObject({page:2,limit:50,status:"PUBLISHED",type:"MCP"});
  });

  it("declares dedicated Tool Registry permissions",()=>{
    const reflector=new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions",ToolRegistryController.prototype.list)).toEqual(["tool.registry.read"]);
    expect(reflector.get("permissions",ToolRegistryController.prototype.create)).toEqual(["tool.registry.write"]);
    expect(reflector.get("permissions",ToolRegistryController.prototype.publish)).toEqual(["tool.registry.publish"]);
    expect(reflector.get("permissions",ToolRegistryController.prototype.rollback)).toEqual(["tool.registry.rollback"]);
    expect(reflector.get("permissions",ToolRegistryController.prototype.archive)).toEqual(["tool.registry.archive"]);
    expect(reflector.get("permissions",ToolRegistryController.prototype.delete)).toEqual(["tool.registry.delete"]);
    expect(reflector.get("permissions",ToolRegistryController.prototype.createCategory)).toEqual(["tool.registry.manage"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
