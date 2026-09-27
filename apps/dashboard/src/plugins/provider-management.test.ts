import { describe,expect,it } from "vitest";
import { providerManagementPlugin } from "./provider-management";
describe("provider management plugin",()=>{it("registers the real route and permission",()=>{expect(providerManagementPlugin.permissions).toEqual(["ai.configure"]);expect(providerManagementPlugin.routes[0]).toMatchObject({path:"/ai/providers",permissions:["ai.configure"]});expect(providerManagementPlugin.navigation?.[0]?.route).toBe("/ai/providers")})});
