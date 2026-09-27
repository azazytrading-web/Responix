import type { DashboardPlugin } from "./types";
import { PromptListPage } from "./prompt-library/list-page";

export const promptLibraryPlugin: DashboardPlugin = {
  id: "prompt-library",
  name: "Prompt Library",
  version: "1.0.0",
  icon: "BookOpen",
  permissions: ["prompt.library.read"],
  routes: [{ path: "/ai/prompts", labelKey: "prompts", icon: "BookOpen", permissions: ["prompt.library.read"], component: PromptListPage }],
  navigation: [{ labelKey: "prompts", route: "/ai/prompts", icon: "BookOpen", permissions: ["prompt.library.read"] }]
};
