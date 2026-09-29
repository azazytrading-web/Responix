import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@responix/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderManagementPage } from "./page";
import type { ProviderConfiguration, ProviderOption } from "./provider-api";

const api = vi.hoisted(() => ({
  listProviders: vi.fn(),
  getProviderConfiguration: vi.fn(),
  configureProvider: vi.fn(),
  validateProvider: vi.fn(),
  providerQueryKey: (workspaceId?: string) => ["workspace", workspaceId, "ai-providers"] as const
}));

interface ListMock {
  data: ProviderOption[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: ReturnType<typeof vi.fn>;
}

interface ConfigMock {
  data: ProviderConfiguration | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
}

interface Mocks {
  platform: {
    state: string;
    snapshot: { workspace: { id: string } };
    retry: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
  };
  list: ListMock;
  config: ConfigMock;
  listConfig: { queryKey: readonly unknown[] } | undefined;
  configConfig: { queryKey: readonly unknown[] } | undefined;
  invalidate: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted<Mocks>(() => ({
  platform: {
    state: "READY",
    snapshot: { workspace: { id: "w1" } },
    retry: vi.fn(),
    hasPermission: vi.fn()
  },
  list: undefined as unknown as ListMock,
  config: undefined as unknown as ConfigMock,
  listConfig: undefined,
  configConfig: undefined,
  invalidate: vi.fn()
}));

vi.mock("./provider-api", () => api);
vi.mock("../../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: { queryKey: readonly unknown[] }) => {
    if (c.queryKey.length === 3) {
      mocks.listConfig = c;
      return mocks.list;
    }
    mocks.configConfig = c;
    return mocks.config;
  },
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  useMutation: (c: { mutationFn: () => Promise<unknown>; onSuccess?: (result: unknown) => unknown }) => ({
    isPending: false,
    mutateAsync: async () => {
      const result = await c.mutationFn();
      await c.onSuccess?.(result);
      return result;
    }
  })
}));

const providerFixture: ProviderOption = {
  id: "p1",
  providerName: "OpenAI",
  status: "ACTIVE",
  priority: 10,
  configured: true,
  providerConfigurationId: "c1",
  credentialConfigured: true,
  enabled: true,
  models: [{
    modelId: "m1",
    modelName: "gpt-5.2",
    displayName: "GPT 5.2",
    version: "2026-01",
    categories: ["chat", "reasoning"],
    status: "ACTIVE",
    priority: 5,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsAudio: false,
    supportsTools: true,
    supportsFunctionCalling: true,
    supportsVideo: false,
    supportsMcp: true,
    supportsReasoning: false,
    supportsStreaming: true
  }]
};

const configurationFixture: ProviderConfiguration = {
  providerId: "p1",
  providerName: "OpenAI",
  configured: true,
  enabled: true,
  credentialConfigured: true,
  settings: { apiBaseUrl: "https://api.openai.com" },
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const withProvider = (overrides: Partial<ProviderOption> = {}): ProviderOption => ({ ...providerFixture, ...overrides });
const withConfiguration = (overrides: Partial<ProviderConfiguration> = {}): ProviderConfiguration => ({ ...configurationFixture, ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.state = "READY";
  mocks.platform.snapshot = { workspace: { id: "w1" } };
  mocks.platform.hasPermission.mockImplementation((permission: string) => permission === "ai.configure" || permission.startsWith("ai.providers"));
  mocks.list = { data: [withProvider()], isPending: false, isError: false, error: null, refetch: vi.fn() };
  mocks.config = { data: withConfiguration(), isPending: false, isError: false, refetch: vi.fn() };
  mocks.listConfig = undefined;
  mocks.configConfig = undefined;
  api.configureProvider.mockResolvedValue(withConfiguration());
  api.validateProvider.mockResolvedValue({ providerId: "p1", available: true, checkedAt: "2026-01-02T00:00:00.000Z", latencyMs: 42 });
});

describe("ProviderManagementPage", () => {
  it("shows backend capabilities, priorities, and write-only credential input", () => {
    render(<ProviderManagementPage />);
    expect(screen.getByText("GPT 5.2")).toBeInTheDocument();
    expect(screen.getByText("1 model exposed by the backend")).toBeInTheDocument();
    expect(screen.getByText(/credentials are write-only and encrypted/i)).toBeInTheDocument();
    expect(screen.getByText("Vision: Yes")).toBeInTheDocument();
    expect(screen.getByText("Function calling: Yes")).toBeInTheDocument();
    expect(screen.getByText("MCP: Yes")).toBeInTheDocument();
    expect(screen.getByText("Version: 2026-01")).toBeInTheDocument();
    expect(screen.getByText("Categories: chat, reasoning")).toBeInTheDocument();
    expect(screen.getByText("Priority 10")).toBeInTheDocument();
    expect(screen.getByText("Priority: 5")).toBeInTheDocument();
    expect(screen.getByLabelText("API credential replacement")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Enabled")).toBeInTheDocument();
  });

  it("scopes provider and configuration queries by workspace", () => {
    render(<ProviderManagementPage />);
    expect(mocks.listConfig).toMatchObject({ queryKey: ["workspace", "w1", "ai-providers"] });
    expect(mocks.configConfig).toMatchObject({ queryKey: ["workspace", "w1", "ai-providers", "p1", "configuration"] });
  });

  it("shows the loading state while the provider list resolves", () => {
    mocks.list.isPending = true;
    render(<ProviderManagementPage />);
    expect(screen.queryByText("AI Providers")).not.toBeInTheDocument();
  });

  it("shows the empty state when the workspace has no providers", () => {
    mocks.list.data = [];
    render(<ProviderManagementPage />);
    expect(screen.getByText("No providers available")).toBeInTheDocument();
    expect(screen.getByText(/no active AI providers/i)).toBeInTheDocument();
  });

  it("surfaces the list API error message and offers retry", () => {
    mocks.list.isError = true;
    mocks.list.error = new ApiError(503, "AI_UNAVAILABLE", "AI providers are temporarily unavailable");
    render(<ProviderManagementPage />);
    expect(screen.getByText("AI providers are temporarily unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.list.refetch).toHaveBeenCalledTimes(1);
  });

  it("denies access without ai.configure", () => {
    mocks.platform.hasPermission.mockReturnValue(false);
    render(<ProviderManagementPage />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.getByText(/ai\.configure permission is required/i)).toBeInTheDocument();
  });

  it("hides configuration details without ai.providers.read", () => {
    mocks.platform.hasPermission.mockImplementation((permission: string) => permission === "ai.configure");
    render(<ProviderManagementPage />);
    expect(screen.getByText("Configuration details require ai.providers.read.")).toBeInTheDocument();
    expect(screen.queryByLabelText("API credential replacement")).not.toBeInTheDocument();
  });

  it("hides save and validate actions without their permissions", () => {
    mocks.platform.hasPermission.mockImplementation((permission: string) => permission === "ai.configure" || permission === "ai.providers.read");
    render(<ProviderManagementPage />);
    expect(screen.queryByRole("button", { name: "Save configuration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Validate connection" })).not.toBeInTheDocument();
  });

  it("saves endpoint, credential replacement, and optimistic concurrency token", async () => {
    render(<ProviderManagementPage />);
    fireEvent.change(screen.getByLabelText("HTTPS endpoint (optional)"), { target: { value: "https://api.openai.com/v1" } });
    fireEvent.change(screen.getByLabelText("API credential replacement"), { target: { value: "sk-test-1234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
    await vi.waitFor(() => {
      expect(api.configureProvider).toHaveBeenCalledWith("p1", {
        enabled: true,
        settings: { apiBaseUrl: "https://api.openai.com/v1" },
        credential: { name: "default", secret: "sk-test-1234567890" },
        expectedUpdatedAt: "2026-01-01T00:00:00.000Z"
      });
      expect(screen.getByText("Provider configuration saved.")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("API credential replacement")).toHaveValue("");
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["workspace", "w1", "ai-providers"] });
  });

  it("saves the enabled flag without sending credentials or settings when fields are blank", async () => {
    mocks.list.data = [withProvider({ configured: false, credentialConfigured: false, enabled: false })];
    mocks.config.data = { providerId: "p1", providerName: "OpenAI", configured: false, enabled: false, credentialConfigured: false, settings: {} };
    render(<ProviderManagementPage />);
    fireEvent.click(screen.getByLabelText("Enabled"));
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
    await vi.waitFor(() => {
      expect(api.configureProvider).toHaveBeenCalledWith("p1", { enabled: true, settings: {} });
    });
  });

  it("surfaces save failures and reloads the baseline after a 409 conflict", async () => {
    api.configureProvider.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "Provider configuration changed; reload before saving"));
    render(<ProviderManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
    await vi.waitFor(() => expect(screen.getByText("Provider configuration changed; reload before saving")).toBeInTheDocument());
    expect(mocks.config.refetch).toHaveBeenCalledTimes(1);
  });

  it("surfaces non-conflict save failures without reloading the baseline", async () => {
    api.configureProvider.mockRejectedValueOnce(new ApiError(400, "DESTINATION_REJECTED", "Provider endpoint is not an approved destination"));
    render(<ProviderManagementPage />);
    fireEvent.change(screen.getByLabelText("HTTPS endpoint (optional)"), { target: { value: "https://unapproved.example" } });
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
    await vi.waitFor(() => expect(screen.getByText("Provider endpoint is not an approved destination")).toBeInTheDocument());
    expect(mocks.config.refetch).not.toHaveBeenCalled();
  });

  it("does not display or persist the credential after saving", async () => {
    render(<ProviderManagementPage />);
    fireEvent.change(screen.getByLabelText("API credential replacement"), { target: { value: "sk-secret-value-123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
    await vi.waitFor(() => expect(screen.getByText("Provider configuration saved.")).toBeInTheDocument());
    expect(screen.getByLabelText("API credential replacement")).toHaveValue("");
    expect(document.body.textContent).not.toContain("sk-secret-value-123456");
  });

  it("shows the last validation result from the configuration", () => {
    mocks.config.data = withConfiguration({ lastValidatedAt: "2026-01-02T00:00:00.000Z", available: false, errorCode: "CREDENTIAL_EXPIRED" });
    render(<ProviderManagementPage />);
    expect(screen.getByText(/failed \(CREDENTIAL_EXPIRED\)/i)).toBeInTheDocument();
  });

  it("validates the connection and reports latency", async () => {
    render(<ProviderManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Validate connection" }));
    await vi.waitFor(() => {
      expect(api.validateProvider).toHaveBeenCalledWith("p1");
      expect(screen.getByText("Provider validated in 42 ms.")).toBeInTheDocument();
    });
  });

  it("reports failed validation with the backend error code", async () => {
    api.validateProvider.mockResolvedValueOnce({ providerId: "p1", available: false, checkedAt: "2026-01-02T00:00:00.000Z", latencyMs: 15, errorCode: "INVALID_KEY" });
    render(<ProviderManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Validate connection" }));
    await vi.waitFor(() => expect(screen.getByText("Validation failed (INVALID_KEY).")).toBeInTheDocument());
  });

  it("surfaces validation rejections", async () => {
    api.validateProvider.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "AI provider is not configured and enabled"));
    render(<ProviderManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Validate connection" }));
    await vi.waitFor(() => expect(screen.getByText("AI provider is not configured and enabled")).toBeInTheDocument());
  });

  it("disables validation when the saved configuration cannot be validated", () => {
    mocks.config.data = withConfiguration({ enabled: true, credentialConfigured: false });
    render(<ProviderManagementPage />);
    expect(screen.getByRole("button", { name: "Validate connection" })).toBeDisabled();
    expect(screen.getByText(/validation requires saved credentials/i)).toBeInTheDocument();
  });
});
