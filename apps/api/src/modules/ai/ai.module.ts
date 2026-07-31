import { Module } from "@nestjs/common";
import { TenantModule } from "../tenant/tenant.module";
import { AiController } from "./ai.controller";
import {
  AI_PROVIDER_ADAPTERS,
  AI_PROVIDER_FACTORY,
  AI_PROVIDER_REGISTRY,
  AI_INVOCATION_SERVICE,
  AI_ROUTING_SERVICE
} from "./ai.tokens";
import { CostNormalizerService } from "./invocation/cost-normalizer.service";
import { ErrorNormalizerService } from "./invocation/error-normalizer.service";
import { InvocationOrchestratorService } from "./invocation/invocation-orchestrator.service";
import { InvocationRepository } from "./invocation/invocation.repository";
import { InvocationService } from "./invocation/invocation.service";
import { RequestNormalizerService } from "./invocation/request-normalizer.service";
import { ResponseNormalizerService } from "./invocation/response-normalizer.service";
import { UsageNormalizerService } from "./invocation/usage-normalizer.service";
import { CredentialRepository } from "./providers/credential.repository";
import { OpenAiProviderAdapter } from "./providers/openai-provider.adapter";
import { AnthropicProviderAdapter } from "./providers/anthropic-provider.adapter";
import { GeminiProviderAdapter } from "./providers/gemini-provider.adapter";
import { AzureOpenAiProviderAdapter } from "./providers/azure-openai-provider.adapter";
import { OpenRouterProviderAdapter } from "./providers/openrouter-provider.adapter";
import { DeepSeekProviderAdapter } from "./providers/deepseek-provider.adapter";
import { ProviderConfigurationRepository } from "./providers/provider-configuration.repository";
import { ProviderCredentialService } from "./providers/provider-credential.service";
import { ProviderDiscoveryService } from "./providers/provider-discovery.service";
import { ProviderFactory } from "./providers/provider.factory";
import { ProviderRegistry } from "./providers/provider.registry";
import { ProviderRepository } from "./providers/provider.repository";
import { CapabilityResolver } from "./router/capability.resolver";
import { EligibilityResolver } from "./router/eligibility.resolver";
import { FallbackEngine } from "./router/fallback.engine";
import { HealthResolver } from "./router/health.resolver";
import { PriorityEngine } from "./router/priority.engine";
import { RoutingRepository } from "./router/routing.repository";
import { RoutingService } from "./router/routing.service";
import { ProviderCredentialCryptoService } from "./security/provider-credential-crypto.service";
import { ProviderDestinationPolicy } from "./security/provider-destination-policy.service";
import { ProviderDnsResolver } from "./security/provider-dns-resolver.service";
import { ProviderHttpClient } from "./security/provider-http-client.service";
import { RuntimeProtectionRepository } from "./runtime/runtime-protection.repository";
import { CostEstimator } from "./runtime/cost-estimator.service";
import { QuotaService } from "./runtime/quota.service";
import { CapabilityValidator } from "./runtime/capability-validator.service";
import { ReservationService } from "./runtime/reservation.service";
import { AccountingService } from "./runtime/accounting.service";
import { RuntimeProtectionService } from "./runtime/runtime-protection.service";
import { RuntimeRecoveryService } from "./runtime/runtime-recovery.service";

@Module({
  imports: [TenantModule],
  controllers: [AiController],
  providers: [
    OpenAiProviderAdapter,
    AnthropicProviderAdapter,
    GeminiProviderAdapter,
    AzureOpenAiProviderAdapter,
    OpenRouterProviderAdapter,
    DeepSeekProviderAdapter,
    {
      provide: AI_PROVIDER_ADAPTERS,
      inject: [
        OpenAiProviderAdapter, AnthropicProviderAdapter, GeminiProviderAdapter,
        AzureOpenAiProviderAdapter, OpenRouterProviderAdapter, DeepSeekProviderAdapter
      ],
      useFactory: (
        openAi: OpenAiProviderAdapter, claude: AnthropicProviderAdapter,
        gemini: GeminiProviderAdapter, azure: AzureOpenAiProviderAdapter,
        openRouter: OpenRouterProviderAdapter, deepSeek: DeepSeekProviderAdapter
      ) => [openAi, claude, gemini, azure, openRouter, deepSeek]
    },
    ProviderRepository,
    CredentialRepository,
    ProviderConfigurationRepository,
    ProviderCredentialCryptoService,
    ProviderDnsResolver,
    ProviderDestinationPolicy,
    ProviderHttpClient,
    RuntimeProtectionRepository,
    CostEstimator,
    QuotaService,
    CapabilityValidator,
    ReservationService,
    AccountingService,
    RuntimeProtectionService,
    RuntimeRecoveryService,
    ProviderCredentialService,
    ProviderDiscoveryService,
    ProviderRegistry,
    ProviderFactory,
    RoutingRepository,
    CapabilityResolver,
    HealthResolver,
    EligibilityResolver,
    PriorityEngine,
    FallbackEngine,
    RoutingService,
    InvocationRepository,
    RequestNormalizerService,
    UsageNormalizerService,
    CostNormalizerService,
    ResponseNormalizerService,
    ErrorNormalizerService,
    InvocationOrchestratorService,
    InvocationService,
    { provide: AI_PROVIDER_REGISTRY, useExisting: ProviderRegistry },
    { provide: AI_PROVIDER_FACTORY, useExisting: ProviderFactory },
    { provide: AI_ROUTING_SERVICE, useExisting: RoutingService },
    { provide: AI_INVOCATION_SERVICE, useExisting: InvocationService }
  ],
  exports: [
    AI_PROVIDER_REGISTRY,
    AI_PROVIDER_FACTORY,
    AI_ROUTING_SERVICE,
    AI_INVOCATION_SERVICE,
    ProviderCredentialService,
    ProviderDiscoveryService,
    ProviderConfigurationRepository,
    ProviderHttpClient,
    ProviderCredentialCryptoService
  ]
})
export class AiModule {}
