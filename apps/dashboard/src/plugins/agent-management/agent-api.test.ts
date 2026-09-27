import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAgent, getAgent, listAgents, listPrompts, listProviders, publishAgent, updateAgent, type AgentWriteInput } from "./agent-api";

const api = vi.hoisted(() => ({ get:vi.fn(), post:vi.fn(), put:vi.fn() }));
vi.mock("@responix/api-client", () => ({ apiClient:api }));
const input:AgentWriteInput={name:"Support",slug:"support",visibility:"WORKSPACE",configuration:{providerId:"p1",modelId:"m1",temperature:0.7,maxTokens:1024},capabilities:{streamingEnabled:true},promptBindings:[]};

describe("agent management API",()=>{
  beforeEach(()=>Object.values(api).forEach((mock)=>mock.mockReset().mockResolvedValue({})));
  it("uses the workspace-scoped Agent Studio routes",async()=>{await listAgents(2,"support");await getAgent("a1");await createAgent(input);await updateAgent("a1",input);await publishAgent("a1");expect(api.get).toHaveBeenCalledWith("/api/v1/agent-studio/agents",{credentials:"include",query:{page:2,limit:25,search:"support"}});expect(api.get).toHaveBeenCalledWith("/api/v1/agent-studio/agents/a1",{credentials:"include"});expect(api.post).toHaveBeenCalledWith("/api/v1/agent-studio/agents",input,{credentials:"include"});expect(api.put).toHaveBeenCalledWith("/api/v1/agent-studio/agents/a1",input,{credentials:"include"});expect(api.post).toHaveBeenCalledWith("/api/v1/agent-studio/agents/a1/publish",{changeSummary:"Published from Agent configuration"},{credentials:"include"})});
  it("loads authoritative providers and Prompt Library options",async()=>{await listProviders();await listPrompts();expect(api.get).toHaveBeenCalledWith("/api/v1/ai/providers",{credentials:"include"});expect(api.get).toHaveBeenCalledWith("/api/v1/prompt-library",{credentials:"include",query:{page:1,limit:100,archived:false,sortBy:"name",sortOrder:"asc"}})});
});
