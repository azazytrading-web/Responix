import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { ProviderCredentialCryptoService } from "../security/provider-credential-crypto.service";
import type { WorkspaceProviderConfiguration } from "./provider.types";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export interface SafeProviderConfiguration {
  providerId: string;
  providerName: string;
  configured: boolean;
  enabled: boolean;
  credentialConfigured: boolean;
  settings: Record<string, unknown>;
  updatedAt?: Date;
  lastValidatedAt?: Date;
  available?: boolean;
  errorCode?: string;
}

@Injectable()
export class ProviderConfigurationRepository {
  constructor(private readonly prisma: PrismaService, private readonly crypto: ProviderCredentialCryptoService) {}

  async find(
    workspaceId: string,
    providerId: string
  ): Promise<WorkspaceProviderConfiguration | null> {
    const configuration = await this.prisma.aiProviderConfiguration.findFirst({
      where: { workspaceId, providerId, deletedAt: null },
      select: {
        id: true,
        workspaceId: true,
        providerId: true,
        enabled: true,
        settings: true
      }
    });
    if (!configuration) return null;
    return {
      ...configuration,
      settings:
        typeof configuration.settings === "object" &&
        configuration.settings !== null &&
        !Array.isArray(configuration.settings)
          ? configuration.settings
          : {}
    };
  }

  async configure(input: { workspaceId:string; actorId:string; providerId:string; enabled:boolean; settings:Record<string,unknown>; credential?:{name:string;secret:string}; expectedUpdatedAt?:Date }):Promise<SafeProviderConfiguration> {
    await this.prisma.$transaction(async tx => {
      const provider=await tx.aiProvider.findFirst({where:{id:input.providerId,status:{not:"DISABLED"}},select:{id:true,providerName:true}});
      if(!provider)throw new NotFoundException("AI provider was not found");
      const current=await tx.aiProviderConfiguration.findUnique({where:{workspaceId_providerId:{workspaceId:input.workspaceId,providerId:input.providerId}},select:{id:true,enabled:true,settings:true,updatedAt:true,deletedAt:true}});
      if(input.expectedUpdatedAt&&current&&current.updatedAt.getTime()!==input.expectedUpdatedAt.getTime())throw new ConflictException("Provider configuration changed; reload before saving");
      const configuration=await tx.aiProviderConfiguration.upsert({where:{workspaceId_providerId:{workspaceId:input.workspaceId,providerId:input.providerId}},create:{workspaceId:input.workspaceId,providerId:input.providerId,enabled:input.enabled,settings:json(input.settings)},update:{enabled:input.enabled,settings:json(input.settings),deletedAt:null},select:{id:true,enabled:true,settings:true,updatedAt:true}});
      if(input.credential){
        const encryptedSecret=this.crypto.encrypt(input.credential.secret),keyFingerprint=this.crypto.fingerprint(input.credential.secret);
        await tx.aiProviderCredential.upsert({where:{workspaceId_providerId_name:{workspaceId:input.workspaceId,providerId:input.providerId,name:input.credential.name}},create:{workspaceId:input.workspaceId,providerId:input.providerId,name:input.credential.name,encryptedSecret,keyFingerprint,status:"ACTIVE"},update:{encryptedSecret,keyFingerprint,encryptionVersion:1,status:"ACTIVE",deletedAt:null}});
      }
      const before=current?{enabled:current.enabled,settings:this.safeSettings(current.settings),credentialReplaced:Boolean(input.credential)}:null;
      const after={enabled:configuration.enabled,settings:this.safeSettings(configuration.settings),credentialConfigured:Boolean(input.credential)};
      await tx.auditLog.create({data:{workspaceId:input.workspaceId,userId:input.actorId,action:current?"ai.provider.configuration.updated":"ai.provider.configuration.created",entityType:"AiProviderConfiguration",entityId:configuration.id,oldValues:before===null?Prisma.JsonNull:json(before),newValues:json(after)}});
    });
    return this.getSafe(input.workspaceId,input.providerId);
  }

  async getSafe(workspaceId:string,providerId:string):Promise<SafeProviderConfiguration>{
    const provider=await this.prisma.aiProvider.findUnique({where:{id:providerId},select:{id:true,providerName:true,configurations:{where:{workspaceId,deletedAt:null},select:{enabled:true,settings:true,updatedAt:true}},credentials:{where:{workspaceId,status:"ACTIVE",deletedAt:null},select:{id:true},take:1},healthRecords:{where:{workspaceId},orderBy:{checkedAt:"desc"},select:{available:true,errorCode:true,checkedAt:true},take:1}}});
    if(!provider)throw new NotFoundException("AI provider was not found");
    const configuration=provider.configurations[0],health=provider.healthRecords[0];
    return {providerId:provider.id,providerName:provider.providerName,configured:Boolean(configuration),enabled:configuration?.enabled??false,credentialConfigured:provider.credentials.length>0,settings:this.safeSettings(configuration?.settings),...(configuration?{updatedAt:configuration.updatedAt}:{}),...(health?{lastValidatedAt:health.checkedAt,available:health.available,...(health.errorCode?{errorCode:health.errorCode}:{})}:{})};
  }

  async validationTarget(workspaceId:string,providerId:string){
    const provider=await this.prisma.aiProvider.findUnique({where:{id:providerId},select:{id:true,providerName:true,apiBaseUrl:true,status:true,configurations:{where:{workspaceId,deletedAt:null},select:{enabled:true,settings:true}},models:{where:{status:"ACTIVE"},orderBy:[{priority:"desc"},{modelName:"asc"}],select:{id:true,modelName:true,maxOutputTokens:true},take:1}}});
    if(!provider)throw new NotFoundException("AI provider was not found");
    const configuration=provider.configurations[0],model=provider.models[0];
    if(!configuration||!configuration.enabled)throw new ConflictException("AI provider is not configured and enabled");
    if(!model)throw new ConflictException("AI provider has no active model");
    const settings=this.record(configuration.settings);
    return {providerId:provider.id,providerName:provider.providerName,modelId:model.id,modelName:model.modelName,apiBaseUrl:typeof settings.apiBaseUrl==="string"?settings.apiBaseUrl:provider.apiBaseUrl,maxOutputTokens:Math.min(model.maxOutputTokens??8,8)};
  }

  async recordValidation(input:{workspaceId:string;actorId:string;providerId:string;credentialId?:string;available:boolean;latencyMs:number;errorCode?:string}){
    return this.prisma.$transaction(async tx=>{const record=await tx.aiProviderHealthRecord.create({data:{workspaceId:input.workspaceId,providerId:input.providerId,credentialId:input.credentialId,available:input.available,latencyMs:input.latencyMs,errorCode:input.errorCode},select:{checkedAt:true}});await tx.auditLog.create({data:{workspaceId:input.workspaceId,userId:input.actorId,action:"ai.provider.validated",entityType:"AiProvider",entityId:input.providerId,oldValues:Prisma.JsonNull,newValues:json({available:input.available,latencyMs:input.latencyMs,...(input.errorCode?{errorCode:input.errorCode}:{})})}});return record;});
  }

  private record(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?{...value}:{};}
  private safeSettings(value:unknown):Record<string,unknown>{const settings=this.record(value);return typeof settings.apiBaseUrl==="string"?{apiBaseUrl:settings.apiBaseUrl}:{};}
}
