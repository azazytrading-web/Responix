import type { EntityOption } from "../../components/interface";
import type {
  Preset,
  ResourceLimit,
  ThresholdBands,
  WeightDimension
} from "../../components/interface";

export const interfaceDemoEntities: readonly EntityOption[] = [
  {
    id: "demo-provider-openai",
    label: "OpenAI compatible",
    secondary: "Fixture provider · demo only",
    type: "Provider",
    scope: "Platform",
    lifecycle: "Active",
    status: "healthy"
  },
  {
    id: "demo-provider-local",
    label: "Local inference",
    secondary: "Fixture provider · demo only",
    type: "Provider",
    scope: "Development",
    lifecycle: "Configured",
    status: "unknown"
  },
  {
    id: "demo-provider-legacy",
    label: "Archive adapter",
    secondary: "Fixture provider · demo only",
    type: "Provider",
    scope: "Sandbox",
    lifecycle: "Inactive",
    status: "inactive",
    disabledReason: "Inactive fixture cannot be selected."
  }
];

export const interfaceDemoProfileValues = {
  reasoning: 70,
  retrieval: 55,
  memory: 45,
  verification: 80
} as const;

export const interfaceDemoPresets: readonly Preset[] = [
  {
    id: "fast",
    label: "FAST",
    description: "Lower configured ceiling",
    values: { reasoning: 35, retrieval: 35, memory: 30, verification: 55 }
  },
  {
    id: "balanced",
    label: "BALANCED",
    description: "Balanced demo configuration",
    values: interfaceDemoProfileValues
  },
  {
    id: "deep",
    label: "DEEP",
    description: "Higher configured ceiling",
    values: { reasoning: 90, retrieval: 80, memory: 75, verification: 95 }
  }
];

export const interfaceDemoProfileRevisions = { current: "demo-r4", verified: "demo-r5" } as const;

export const interfaceDemoWeights: readonly WeightDimension[] = [
  { id: "reasoning", label: "Reasoning", value: 28 },
  { id: "retrieval", label: "Retrieval", value: 24 },
  { id: "memory", label: "Memory", value: 18, locked: true },
  { id: "verification", label: "Verification", value: 18 },
  { id: "efficiency", label: "Efficiency", value: 12 }
];

export const interfaceDemoWeightPresets: readonly Preset[] = [
  {
    id: "fast",
    label: "FAST",
    description: "Lower configured ceiling",
    values: { reasoning: 32, retrieval: 28, memory: 18, verification: 16, efficiency: 6 }
  },
  {
    id: "balanced",
    label: "BALANCED",
    description: "Balanced local allocation",
    values: { reasoning: 28, retrieval: 24, memory: 18, verification: 18, efficiency: 12 }
  },
  {
    id: "deep",
    label: "DEEP",
    description: "More verification capacity",
    values: { reasoning: 24, retrieval: 18, memory: 18, verification: 28, efficiency: 12 }
  }
];

export const interfaceDemoThresholds: ThresholdBands = {
  healthy: 30,
  elevated: 55,
  warning: 78,
  critical: 92
};

export const interfaceDemoBudgets: readonly ResourceLimit[] = [
  { id: "provider", label: "Provider calls", value: 40, max: 100, unit: "calls" },
  { id: "retrieval", label: "Retrieval depth", value: 6, max: 20, unit: "steps" },
  { id: "tools", label: "Tool calls", value: 8, max: 30, unit: "calls" },
  { id: "search", label: "Search nodes", value: 12, max: 40, unit: "nodes" },
  { id: "output", label: "Output ceiling", value: 1800, max: 8192, unit: "tokens" }
];

export const interfaceDemoRelationshipLevels = [
  {
    id: "family",
    label: "Model family",
    options: [
      {
        id: "demo-family-core",
        label: "Oi Core",
        type: "Family",
        scope: "Demo",
        lifecycle: "Active"
      },
      {
        id: "demo-family-vision",
        label: "Oi Vision",
        type: "Family",
        scope: "Demo",
        lifecycle: "Draft"
      }
    ]
  },
  {
    id: "edition",
    label: "Edition",
    options: [
      {
        id: "demo-edition-prod",
        label: "1.7 Production",
        type: "Edition",
        scope: "Demo",
        lifecycle: "Production",
        parentId: "demo-family-core"
      },
      {
        id: "demo-edition-canary",
        label: "1.6 Canary",
        type: "Edition",
        scope: "Demo",
        lifecycle: "Canary",
        parentId: "demo-family-core"
      },
      {
        id: "demo-edition-vision",
        label: "1.0 Preview",
        type: "Edition",
        scope: "Demo",
        lifecycle: "Preview",
        parentId: "demo-family-vision"
      }
    ]
  },
  {
    id: "revision",
    label: "Revision",
    options: [
      {
        id: "demo-revision-r4",
        label: "Revision 4",
        type: "Revision",
        scope: "Demo",
        lifecycle: "Current",
        parentId: "demo-edition-prod"
      },
      {
        id: "demo-revision-r3",
        label: "Revision 3",
        type: "Revision",
        scope: "Demo",
        lifecycle: "Previous",
        parentId: "demo-edition-canary"
      },
      {
        id: "demo-revision-v1",
        label: "Revision 1",
        type: "Revision",
        scope: "Demo",
        lifecycle: "Preview",
        parentId: "demo-edition-vision"
      }
    ]
  }
] as const;

export const interfaceDemoScopes = [
  { id: "models:read", label: "models:read", description: "Read model definitions" },
  { id: "profiles:read", label: "profiles:read", description: "Read profile revisions" },
  { id: "runtime:invoke", label: "runtime:invoke", description: "Invoke the local demo runtime" },
  { id: "providers:write", label: "providers:write", description: "Not granted in this fixture" }
] as const;
