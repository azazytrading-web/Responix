import { BadRequestException, Injectable } from "@nestjs/common";
import type { ConfigureProviderDto, ProviderConfigurationResponseDto, ProviderValidationResponseDto } from "../dto/provider-configuration.dto";
import { ProviderDestinationPolicy, ProviderDestinationRejectedError } from "../security/provider-destination-policy.service";
import { ProviderConfigurationRepository, type SafeProviderConfiguration } from "./provider-configuration.repository";
import { ProviderCredentialService } from "./provider-credential.service";
import { ProviderRegistry } from "./provider.registry";

const supportedProviders=new Set(["OpenAI","Azure OpenAI","Claude","Anthropic","DeepSeek","OpenRouter","Gemini"]);

@Injectable()
export class ProviderManagementService{
 constructor(private readonly repository:ProviderConfigurationRepository,private readonly credentials:ProviderCredentialService,private readonly registry:ProviderRegistry,private readonly destinations:ProviderDestinationPolicy){}
 async configure(workspaceId:string,actorId:string,providerId:string,dto:ConfigureProviderDto):Promise<ProviderConfigurationResponseDto>{
  const settings=this.normalizeSettings(dto.settings??{});
  if(settings.apiBaseUrl){try{await this.destinations.authorize(settings.apiBaseUrl)}catch(error){if(error instanceof ProviderDestinationRejectedError)throw new BadRequestException("Provider endpoint is not an approved destination");throw error}}
  const current=await this.repository.getSafe(workspaceId,providerId);
  if(!supportedProviders.has(current.providerName)||!this.registry.has(current.providerName))throw new BadRequestException("Provider adapter is not supported");
  if(current.providerName==="Azure OpenAI"&&!settings.apiBaseUrl&&!current.settings.apiBaseUrl)throw new BadRequestException("Azure OpenAI requires an approved HTTPS endpoint");
  const state=await this.repository.configure({workspaceId,actorId,providerId,enabled:dto.enabled,settings:{...current.settings,...settings},...(dto.credential?{credential:{name:dto.credential.name?.trim()||"default",secret:dto.credential.secret}}:{}),...(dto.expectedUpdatedAt?{expectedUpdatedAt:new Date(dto.expectedUpdatedAt)}:{})});
  return this.response(state);
 }
 async get(workspaceId:string,providerId:string){return this.response(await this.repository.getSafe(workspaceId,providerId));}
 async validate(workspaceId:string,actorId:string,providerId:string):Promise<ProviderValidationResponseDto>{
  const target=await this.repository.validationTarget(workspaceId,providerId),adapter=this.registry.get(target.providerName),started=Date.now();let available=true,errorCode:string|undefined;
  try{await this.credentials.useCredential(workspaceId,providerId,credential=>adapter.invoke({requestId:`provider-validation-${Date.now()}`,modelId:target.modelId,modelName:target.modelName,apiBaseUrl:target.apiBaseUrl,messages:[{role:"user",content:"Reply OK."}],maxOutputTokens:target.maxOutputTokens,signal:AbortSignal.timeout(15_000)},credential).then(()=>undefined));}catch(error){available=false;errorCode=this.safeErrorCode(error)}
  const latencyMs=Date.now()-started,record=await this.repository.recordValidation({workspaceId,actorId,providerId,available,latencyMs,...(errorCode?{errorCode}:{})});
  return {providerId,available,checkedAt:record.checkedAt.toISOString(),latencyMs,...(errorCode?{errorCode}:{})};
 }
 private normalizeSettings(settings:{apiBaseUrl?:string}){return settings.apiBaseUrl?{apiBaseUrl:settings.apiBaseUrl.trim().replace(/\/$/,"")}:{};}
 private safeErrorCode(error:unknown){if(error&&typeof error==="object"&&"code" in error&&typeof error.code==="string"&&/^[A-Z_]+$/.test(error.code))return error.code;return "VALIDATION_FAILED";}
 private response(value:SafeProviderConfiguration):ProviderConfigurationResponseDto{return {providerId:value.providerId,providerName:value.providerName,configured:value.configured,enabled:value.enabled,credentialConfigured:value.credentialConfigured,settings:value.settings,...(value.updatedAt?{updatedAt:value.updatedAt.toISOString()}:{}),...(value.lastValidatedAt?{lastValidatedAt:value.lastValidatedAt.toISOString()}:{}),...(value.available===undefined?{}:{available:value.available}),...(value.errorCode?{errorCode:value.errorCode}:{})};}
}
