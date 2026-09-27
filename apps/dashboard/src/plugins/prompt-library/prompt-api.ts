import { apiClient } from "@responix/api-client";

export type PromptStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export interface PromptVariable { name:string; type:"string"|"number"|"boolean"|"json"; description?:string; required?:boolean; defaultValue?:unknown }
export interface PromptNamed { id:string; workspaceId:string; name:string; slug:string; createdAt:string; updatedAt?:string }
export interface PromptRecord { id:string; workspaceId:string; categoryId:string|null; name:string; slug:string; description:string|null; status:PromptStatus; draft:Record<string,unknown>; variables:PromptVariable[]; metadata:Record<string,unknown>; revision:number; favorite:boolean; createdById:string; updatedById:string; createdAt:string; updatedAt:string; deletedAt:string|null; category:PromptNamed|null; tags:Array<{tag:PromptNamed}> }
export interface PromptPage { data:PromptRecord[]; pagination:{page:number;limit:number;total:number;totalPages:number} }
export interface PromptListInput { page:number; search?:string; status?:PromptStatus; archived?:boolean }
export interface PromptWriteInput { name:string; slug?:string; description?:string|null; categoryId?:string|null; tagIds?:string[]; draft:Record<string,unknown>; variables:PromptVariable[]; metadata?:Record<string,unknown> }

const config={credentials:"include" as const};
export const promptQueryRoot=(workspaceId?:string)=>["workspace",workspaceId,"prompts"] as const;
export function listPrompts(input:PromptListInput):Promise<PromptPage>{return apiClient.get<PromptPage>("/api/v1/prompt-library",{...config,query:{page:input.page,limit:25,archived:Boolean(input.archived),sortBy:"updatedAt",sortOrder:"desc",...(input.search?{search:input.search}:{}),...(input.status?{status:input.status}:{})}})}
export function getPrompt(id:string,includeArchived=false):Promise<PromptRecord>{return apiClient.get<PromptRecord>(`/api/v1/prompt-library/${id}`,{...config,query:{includeArchived}})}
export function createPrompt(input:PromptWriteInput):Promise<PromptRecord>{return apiClient.post<PromptRecord>("/api/v1/prompt-library",input,config)}
export function updatePrompt(id:string,input:Omit<PromptWriteInput,"slug">):Promise<PromptRecord>{return apiClient.put<PromptRecord>(`/api/v1/prompt-library/${id}`,input,config)}
export function clonePrompt(id:string,input:{name:string;slug:string}):Promise<PromptRecord>{return apiClient.post<PromptRecord>(`/api/v1/prompt-library/${id}/clone`,input,config)}
export function publishPrompt(id:string,changeSummary?:string):Promise<{prompt:PromptRecord}>{return apiClient.post<{prompt:PromptRecord}>(`/api/v1/prompt-library/${id}/publish`,changeSummary?{changeSummary}:{},config)}
export function archivePrompt(id:string):Promise<PromptRecord>{return apiClient.post<PromptRecord>(`/api/v1/prompt-library/${id}/archive`,{},config)}
export function restorePrompt(id:string):Promise<PromptRecord>{return apiClient.post<PromptRecord>(`/api/v1/prompt-library/${id}/restore`,{},config)}
export function deletePrompt(id:string):Promise<unknown>{return apiClient.delete(`/api/v1/prompt-library/${id}`,config)}
export function favoritePrompt(id:string,favorite:boolean):Promise<PromptRecord>{return apiClient.put<PromptRecord>(`/api/v1/prompt-library/${id}/favorite`,{favorite},config)}
export function listCategories():Promise<PromptNamed[]>{return apiClient.get<PromptNamed[]>("/api/v1/prompt-library/categories",config)}
export function listTags():Promise<PromptNamed[]>{return apiClient.get<PromptNamed[]>("/api/v1/prompt-library/tags",config)}
export function createCategory(name:string,slug:string):Promise<PromptNamed>{return apiClient.post<PromptNamed>("/api/v1/prompt-library/categories",{name,slug},config)}
export function createTag(name:string,slug:string):Promise<PromptNamed>{return apiClient.post<PromptNamed>("/api/v1/prompt-library/tags",{name,slug},config)}
export function updateCategory(id:string,name:string,slug:string):Promise<PromptNamed>{return apiClient.put<PromptNamed>(`/api/v1/prompt-library/categories/${id}`,{name,slug},config)}
export function updateTag(id:string,name:string,slug:string):Promise<PromptNamed>{return apiClient.put<PromptNamed>(`/api/v1/prompt-library/tags/${id}`,{name,slug},config)}
export function deleteCategory(id:string):Promise<unknown>{return apiClient.delete(`/api/v1/prompt-library/categories/${id}`,config)}
export function deleteTag(id:string):Promise<unknown>{return apiClient.delete(`/api/v1/prompt-library/tags/${id}`,config)}
