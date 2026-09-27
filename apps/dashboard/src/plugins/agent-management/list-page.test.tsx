import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentListPage } from "./list-page";

interface ListMocks { platform:{state:string;snapshot:{workspace:{id:string}}|null;retry:ReturnType<typeof vi.fn>;hasPermission:ReturnType<typeof vi.fn<(permission:string)=>boolean>>};query:{data:unknown;isPending:boolean;isError:boolean;refetch:ReturnType<typeof vi.fn>};config:unknown;mutation:{isPending:boolean;mutateAsync:ReturnType<typeof vi.fn>} }
const mocks=vi.hoisted(():ListMocks=>({platform:{state:"READY",snapshot:{workspace:{id:"w1"}},retry:vi.fn(),hasPermission:vi.fn((permission:string)=>Boolean(permission))},query:{data:{data:[],pagination:{page:1,limit:25,total:0,totalPages:0}},isPending:false,isError:false,refetch:vi.fn()},config:undefined,mutation:{isPending:false,mutateAsync:vi.fn()} }));
vi.mock("../../platform",()=>({usePlatformBootstrap:()=>mocks.platform}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("@tanstack/react-query",()=>({useQuery:(config:unknown)=>{mocks.config=config;return mocks.query},useQueryClient:()=>({invalidateQueries:vi.fn()}),useMutation:()=>mocks.mutation}));

describe("AgentListPage",()=>{
  beforeEach(()=>{vi.spyOn(window,"confirm").mockReturnValue(true);mocks.mutation.mutateAsync.mockReset();mocks.platform.state="READY";mocks.platform.snapshot={workspace:{id:"w1"}};mocks.platform.hasPermission.mockReturnValue(true);mocks.query.data={data:[],pagination:{page:1,limit:25,total:0,totalPages:0}};mocks.query.isPending=false;mocks.query.isError=false});
  it("renders empty and populated workspace states",()=>{const view=render(<AgentListPage/>);expect(screen.getByText("No agents yet")).toBeInTheDocument();mocks.query.data={data:[{id:"a1",name:"Support",slug:"support",description:null,status:"DRAFT",category:null,version:1,visibility:"WORKSPACE"}],pagination:{page:1,limit:25,total:1,totalPages:1}};view.rerender(<AgentListPage/>);expect(screen.getByText("Support")).toBeInTheDocument();expect(screen.getByRole("link",{name:/Support/})).toHaveAttribute("href","/ai/agents/a1")});
  it("uses a workspace-scoped query key and backend search",()=>{render(<AgentListPage/>);expect(mocks.config).toMatchObject({queryKey:["workspace","w1","agents",{page:1,search:""}]});fireEvent.change(screen.getByLabelText("Search agents"),{target:{value:"sales"}});fireEvent.click(screen.getByRole("button",{name:"Search"}));expect(mocks.config).toMatchObject({queryKey:["workspace","w1","agents",{page:1,search:"sales"}]})});
  it("renders retryable errors and permission denial",()=>{mocks.query.isError=true;mocks.query.data=undefined;const view=render(<AgentListPage/>);expect(screen.getByText("Agents unavailable")).toBeInTheDocument();mocks.query.isError=false;mocks.platform.hasPermission.mockImplementation((p:string)=>p!=="agent.studio.read");view.rerender(<AgentListPage/>);expect(screen.getByText("Access denied")).toBeInTheDocument();expect(screen.queryByRole("link",{name:"Create Agent"})).not.toBeInTheDocument()});
  it("renders lifecycle actions gated by status and permission",()=>{mocks.query.data={data:[{id:"a1",name:"Draft Agent",slug:"draft",description:null,status:"DRAFT",category:null,version:0,visibility:"WORKSPACE"},{id:"a2",name:"Published Agent",slug:"published",description:null,status:"PUBLISHED",category:null,version:1,visibility:"WORKSPACE"},{id:"a3",name:"Archived Agent",slug:"archived",description:null,status:"ARCHIVED",category:null,version:1,visibility:"WORKSPACE"}],pagination:{page:1,limit:25,total:3,totalPages:1}};render(<AgentListPage/>);const buttons=screen.getAllByRole("button");const texts=buttons.map((b)=>b.textContent);expect(texts).toContain("Delete");expect(texts).toContain("Archive");expect(texts).toContain("Restore")});
  it("calls the lifecycle mutation for each status-aware action",async()=>{const actionOf=(value:unknown):{id:string;action:string}=>{const id=(value as {id?:string})?.id??"";const action=(value as {action?:string})?.action??"";return {id:typeof id==="string"?id:"",action:typeof action==="string"?action:""}};mocks.query.data={data:[{id:"del",name:"Deleteable",slug:"deleteable",description:null,status:"DRAFT",category:null,version:0,visibility:"WORKSPACE"},{id:"arc",name:"Archivable",slug:"archivable",description:null,status:"PUBLISHED",category:null,version:1,visibility:"WORKSPACE"},{id:"res",name:"Restorable",slug:"restorable",description:null,status:"ARCHIVED",category:null,version:1,visibility:"WORKSPACE"}],pagination:{page:1,limit:25,total:3,totalPages:1}};render(<AgentListPage/>);const buttons=screen.getAllByRole("button");const byName=(t:string)=>buttons.find((b)=>b.textContent===t)!;fireEvent.click(byName("Delete"));fireEvent.click(byName("Archive"));fireEvent.click(byName("Restore"));await vi.waitFor(()=>{const calls=mocks.mutation.mutateAsync.mock.calls.map((c)=>actionOf(c[0]));expect(calls.some((c)=>c.action==="delete"&&c.id==="del")).toBe(true);expect(calls.some((c)=>c.action==="archive"&&c.id==="arc")).toBe(true);expect(calls.some((c)=>c.action==="restore"&&c.id==="res")).toBe(true)})});
  it("requires confirmation before deleting a draft Agent",()=>{const confirm=vi.fn(()=>false);vi.spyOn(window,"confirm").mockImplementation(confirm);mocks.query.data={data:[{id:"del",name:"Deleteable",slug:"deleteable",description:null,status:"DRAFT",category:null,version:0,visibility:"WORKSPACE"}],pagination:{page:1,limit:25,total:1,totalPages:1}};render(<AgentListPage/>);fireEvent.click(screen.getByRole("button",{name:"Delete"}));expect(confirm).toHaveBeenCalledWith("Delete this Agent? This action cannot be undone.");expect(mocks.mutation.mutateAsync).not.toHaveBeenCalled()});
  it("shows Delete and Restore for an archived Agent",()=>{mocks.query.data={data:[{id:"arc",name:"Archived",slug:"archived",description:null,status:"ARCHIVED",category:null,version:1,visibility:"WORKSPACE"}],pagination:{page:1,limit:25,total:1,totalPages:1}};render(<AgentListPage/>);expect(screen.getByRole("button",{name:"Delete"})).toBeInTheDocument();expect(screen.getByRole("button",{name:"Restore"})).toBeInTheDocument()});
  it("marks an agent ACTIVE on a channel and disables archiving",()=>{mocks.query.data={data:[{id:"a1",name:"Live Agent",slug:"live",description:null,status:"PUBLISHED",category:null,version:2,visibility:"WORKSPACE",activeChannels:[{connectionId:"c1",channelId:"ch1"}]}],pagination:{page:1,limit:25,total:1,totalPages:1}};render(<AgentListPage/>);expect(screen.getByText("ACTIVE")).toBeInTheDocument();expect(screen.getByText(/Active on a channel connection/)).toBeInTheDocument();const archive=screen.getByRole("button",{name:"Archive"});expect(archive).toBeDisabled()});
  it("opens the switch dialog from an active channel and calls the switch API",async()=>{
    mocks.mutation.mutateAsync.mockResolvedValue({});
    mocks.query.data={data:[
      {id:"a1",name:"Agent A",slug:"a",description:null,status:"PUBLISHED",category:null,version:2,visibility:"WORKSPACE",activeChannels:[{connectionId:"c1",channelId:"ch1",stateVersion:4}]},
      {id:"a2",name:"Agent B",slug:"b",description:null,status:"PUBLISHED",category:null,version:1,visibility:"WORKSPACE",activeChannels:[]}
    ],pagination:{page:1,limit:25,total:2,totalPages:1}};
    const view=render(<AgentListPage/>);
    fireEvent.click(screen.getByText("Switch agent"));
    expect(mocks.config).toMatchObject({});
    fireEvent.click(screen.getByRole("radio",{name:/Connection c1 · Channel ch1/}));
    fireEvent.change(screen.getByLabelText("Target agent"),{target:{value:"a2"}});
    fireEvent.click(screen.getByRole("button",{name:"Confirm switch"}));
    await vi.waitFor(()=>{
      const calls=mocks.mutation.mutateAsync.mock.calls;
      expect(calls.some((c)=>{const arg=(c[0] as unknown);const a=arg as {id?:string;connectionId?:string;stateVersion?:number};return a.id==="a2"&&a.connectionId==="c1"&&a.stateVersion===4})).toBe(true);
    });
    view.unmount();
  });
  it("surfaces a runtime-not-ready backend error in the switch dialog",async()=>{
    mocks.mutation.mutateAsync.mockRejectedValue(new Error("AGENT_NOT_CHANNEL_READY"));
    mocks.query.data={data:[
      {id:"a1",name:"Agent A",slug:"a",description:null,status:"PUBLISHED",category:null,version:2,visibility:"WORKSPACE",activeChannels:[{connectionId:"c1",channelId:"ch1",stateVersion:0}]},
      {id:"a2",name:"Agent B",slug:"b",description:null,status:"PUBLISHED",category:null,version:1,visibility:"WORKSPACE",activeChannels:[]}
    ],pagination:{page:1,limit:25,total:2,totalPages:1}};
    render(<AgentListPage/>);
    fireEvent.click(screen.getByText("Switch agent"));
    fireEvent.click(screen.getByRole("radio",{name:/Connection c1 · Channel ch1/}));
    fireEvent.change(screen.getByLabelText("Target agent"),{target:{value:"a2"}});
    fireEvent.click(screen.getByRole("button",{name:"Confirm switch"}));
    await vi.waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("AGENT_NOT_CHANNEL_READY"));
  });
});
