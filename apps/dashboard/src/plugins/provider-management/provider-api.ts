import { apiClient } from "@responix/api-client";

export interface ProviderModel { modelId:string; modelName:string; displayName:string; status:"ACTIVE"|"DISABLED"|"DEPRECATED"; priority:number; contextWindow:number; maxOutputTokens?:number; supportsVision:boolean; supportsAudio:boolean; supportsTools:boolean; supportsReasoning:boolean; supportsStreaming:boolean }
export interface ProviderOption { id:string; providerName:string; status:"ACTIVE"|"DISABLED"|"UNHEALTHY"; priority:number; configured:boolean; providerConfigurationId?:string; credentialConfigured?:boolean; enabled:boolean; models:ProviderModel[] }
export interface ProviderConfiguration { providerId:string; providerName:string; configured:boolean; enabled:boolean; credentialConfigured:boolean; settings:Record<string,unknown>; updatedAt?:string; lastValidatedAt?:string; available?:boolean; errorCode?:string }
export interface ProviderConfigurationInput { enabled:boolean; settings?:{apiBaseUrl?:string}; credential?:{name?:string;secret:string}; expectedUpdatedAt?:string }
export interface ProviderValidation { providerId:string; available:boolean; checkedAt:string; latencyMs?:number; errorCode?:string }

export const providerQueryKey = (workspaceId?: string) => ["workspace", workspaceId, "ai-providers"] as const;

export function listProviders(): Promise<ProviderOption[]> {
  return apiClient.get<ProviderOption[]>("/api/v1/ai/providers", { credentials: "include" });
}
export function getProviderConfiguration(providerId:string):Promise<ProviderConfiguration>{return apiClient.get<ProviderConfiguration>(`/api/v1/ai/providers/${providerId}/configuration`,{credentials:"include"})}
export function configureProvider(providerId:string,input:ProviderConfigurationInput):Promise<ProviderConfiguration>{return apiClient.put<ProviderConfiguration>(`/api/v1/ai/providers/${providerId}/configuration`,input,{credentials:"include"})}
export function validateProvider(providerId:string):Promise<ProviderValidation>{return apiClient.post<ProviderValidation>(`/api/v1/ai/providers/${providerId}/validate`,{}, {credentials:"include"})}
