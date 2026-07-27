import assert from "node:assert/strict";
import test from "node:test";
import {
  PlatformExtensionRegistry,
  serializePlatformManifest
} from "../dist/index.js";

function createManifest() {
  return {
    schemaVersion: "1.0",
    id: "workspace-platform",
    dashboard: {
      pages: [
        {
          id: "overview",
          title: "Overview",
          route: "/overview",
          layout: "grid",
          order: 1,
          sections: [
            {
              id: "summary",
              layout: "columns",
              order: 1,
              widgets: [
                {
                  id: "requests",
                  kind: "metric",
                  title: "Requests",
                  order: 1,
                  dataSource: { sourceId: "ai.runtime.metrics" },
                  visibility: { permissions: ["ai.invoke"], featureFlags: ["ai"] }
                },
                {
                  id: "provider-settings",
                  kind: "card",
                  title: "Provider settings",
                  order: 2,
                  form: {
                    id: "provider-credentials",
                    fields: [
                      {
                        id: "api-key",
                        name: "apiKey",
                        kind: "secret",
                        sensitive: true,
                        order: 1,
                        validation: [{ rule: "required" }]
                      },
                      {
                        id: "model",
                        name: "model",
                        kind: "autocomplete",
                        order: 2,
                        dataSource: { sourceId: "ai.models" }
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    navigation: {
      items: [
        {
          id: "overview",
          label: "Overview",
          route: "/overview",
          placement: "sidebar",
          order: 1,
          icon: { name: "home" },
          visibility: { roles: ["ADMIN"] }
        }
      ]
    },
    themes: [
      {
        id: "default",
        brand: { name: "Responix" },
        colors: { primary: "#1640d8", secondary: "#0d9f6e" },
        assets: { logo: "asset://logo", favicon: "asset://favicon" }
      }
    ],
    whiteLabel: {
      company: { name: "Responix" },
      domains: ["app.responix.example"],
      themeId: "default",
      modules: ["ai"],
      customerDashboard: "overview"
    },
    features: [
      {
        id: "ai",
        capabilities: ["invoke"],
        permissions: ["ai.invoke"],
        planRequirements: ["pro"]
      }
    ],
    plugins: [
      {
        id: "openai",
        version: "1.0.0",
        category: "analytics",
        capabilities: ["model-invocation"]
      }
    ],
    openApi: {
      "ai.invoke": {
        operationId: "invokeAi",
        security: ["bearer"],
        requestSchemaId: "AiInvocationRequestDto",
        responseSchemaIds: { "200": "AiInvocationResponseDto" }
      }
    }
  };
}

test("validates a renderer-neutral platform manifest", () => {
  const registry = new PlatformExtensionRegistry();

  assert.deepEqual(registry.validate(createManifest()), { valid: true, errors: [] });
});

test("serializes a detached JSON-compatible contract DTO", () => {
  const manifest = createManifest();
  const serialized = serializePlatformManifest(manifest);

  serialized.dashboard.pages[0].title = "Changed";

  assert.equal(manifest.dashboard.pages[0].title, "Overview");
  assert.deepEqual(JSON.parse(JSON.stringify(serialized)), serialized);
});

test("requires unregistered extension kinds and accepts registered compatible kinds", () => {
  const registry = new PlatformExtensionRegistry();
  const manifest = createManifest();
  manifest.dashboard.pages[0].sections[0].widgets.push({
    id: "custom-chart",
    kind: "heatmap",
    order: 3
  });
  manifest.dashboard.pages[0].sections[0].widgets[1].form.fields.push({
    id: "region",
    name: "region",
    kind: "region-picker",
    order: 3
  });

  assert.deepEqual(registry.validate(manifest).errors, [
    "Unregistered field kind: region-picker",
    "Unregistered widget kind: heatmap"
  ]);

  registry.register({ kind: "widget", id: "heatmap", supportedSchemaVersions: ["1.0"] });
  registry.register({
    kind: "field",
    id: "region-picker",
    supportedSchemaVersions: ["1.0"]
  });

  assert.deepEqual(registry.validate(manifest), { valid: true, errors: [] });
});

test("rejects duplicate extensions and incompatible extension schema versions", () => {
  const registry = new PlatformExtensionRegistry();

  assert.throws(
    () => registry.register({ kind: "widget", id: "heatmap", supportedSchemaVersions: ["2.0"] }),
    /does not support schema 1\.0/
  );

  registry.register({ kind: "widget", id: "heatmap", supportedSchemaVersions: ["1.0"] });
  assert.throws(
    () => registry.register({ kind: "widget", id: "heatmap", supportedSchemaVersions: ["1.0"] }),
    /Duplicate platform widget extension/
  );
});
