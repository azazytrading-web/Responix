UPDATE "OicProviderDefinition" SET "transportProfiles" = array_remove("transportProfiles", 'openai-responses-v1'), "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'openai';
