import { describe,expect,it } from "vitest";
import { promptLibraryPlugin } from "./prompt-library";
describe("Prompt Library plugin",()=>{it("registers the real route and read permission",()=>{expect(promptLibraryPlugin.permissions).toEqual(["prompt.library.read"]);expect(promptLibraryPlugin.routes[0]).toMatchObject({path:"/ai/prompts",permissions:["prompt.library.read"]});expect(promptLibraryPlugin.navigation?.[0]?.route).toBe("/ai/prompts")})});
