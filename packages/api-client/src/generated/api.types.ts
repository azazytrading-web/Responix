// This file is generated from the backend OpenAPI document. Do not edit manually.
// Run `pnpm --filter @responix/api-client openapi:generate` to regenerate.

export interface paths {
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_check_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Authenticate credentials or return a secure workspace-selection challenge */
        post: operations["AuthController_login_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/select-workspace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Complete login using a short-lived credential-verified workspace challenge */
        post: operations["AuthController_selectWorkspace_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rotate the HttpOnly refresh session and return a new access token */
        post: operations["AuthController_refresh_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/switch-workspace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rotate the current session into another active workspace membership */
        post: operations["AuthController_switchWorkspace_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revoke the active workspace session and clear its refresh cookie */
        post: operations["AuthController_logout_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve the current workspace control plane */
        get: operations["PlatformControlController_current_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/manifest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve a visibility-filtered workspace manifest */
        get: operations["PlatformControlController_manifest_v1"];
        /** Store a versioned workspace platform manifest */
        put: operations["PlatformControlController_updateManifest_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/features": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve runtime workspace features */
        get: operations["PlatformControlController_features_v1"];
        /** Set a workspace feature override */
        put: operations["PlatformControlController_updateFeature_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/license": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve workspace license limits and entitlements */
        get: operations["PlatformControlController_license_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/branding": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve workspace branding metadata */
        get: operations["PlatformControlController_branding_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update workspace branding metadata */
        patch: operations["PlatformControlController_updateBranding_v1"];
        trace?: never;
    };
    "/api/v1/platform/permissions/overrides": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Set a workspace or user permission override */
        put: operations["PlatformControlController_updatePermissionOverride_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/permissions/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List workspace and system roles */
        get: operations["PlatformControlController_roles_v1"];
        put?: never;
        /** Create a workspace role */
        post: operations["PlatformControlController_createRole_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/permissions/roles/{roleId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a workspace role */
        delete: operations["PlatformControlController_deleteRole_v1"];
        options?: never;
        head?: never;
        /** Update a workspace role */
        patch: operations["PlatformControlController_updateRole_v1"];
        trace?: never;
    };
    "/api/v1/platform/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List available permission keys */
        get: operations["PlatformControlController_permissions_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/permissions/roles/{roleId}/{permissionCode}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Grant a permission to a role */
        put: operations["PlatformControlController_grant_v1"];
        post?: never;
        /** Revoke a permission from a role */
        delete: operations["PlatformControlController_revoke_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/permissions/assignments/{userId}/{roleId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Assign a role to an active workspace member */
        put: operations["PlatformControlController_assignRole_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/permissions/assignments/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove a member role by removing workspace membership */
        delete: operations["PlatformControlController_removeRole_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/permissions/temporary-roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Assign a time-bound role */
        post: operations["PlatformControlController_temporaryRole_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/platform/permissions/temporary-permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Assign a time-bound permission override */
        post: operations["PlatformControlController_temporaryPermission_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["WorkspaceController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Return the workspace bound to the authenticated session */
        get: operations["WorkspaceController_get_v1"];
        put?: never;
        post?: never;
        delete: operations["WorkspaceController_softDelete_v1"];
        options?: never;
        head?: never;
        patch: operations["WorkspaceController_update_v1"];
        trace?: never;
    };
    "/api/v1/workspaces/current/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["WorkspaceController_suspend_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/current/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["WorkspaceController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/current/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["WorkspaceController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/current/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["WorkspaceController_members_v1"];
        put?: never;
        post: operations["WorkspaceController_invite_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/invitations/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["WorkspaceController_accept_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/invitations/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["WorkspaceController_reject_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/current/members/{membershipId}/invitation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["WorkspaceController_revokeInvitation_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/current/members/{membershipId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["WorkspaceController_remove_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/current/members/{membershipId}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["WorkspaceController_suspendMember_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/current/members/{membershipId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["WorkspaceController_restoreMember_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspaces/current/members/{membershipId}/role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["WorkspaceController_updateMemberRole_v1"];
        trace?: never;
    };
    "/api/v1/ai/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Discover AI providers
         * @description Returns provider-neutral provider and model metadata for the authenticated workspace.
         */
        get: operations["AiController_discover_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/providers/{providerId}/configuration": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get safe workspace provider configuration */
        get: operations["AiController_providerConfiguration_v1"];
        /** Create or update encrypted workspace provider configuration */
        put: operations["AiController_configureProvider_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/providers/{providerId}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Validate workspace provider credentials using a minimal provider request */
        post: operations["AiController_validateProvider_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/routing/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resolve an AI route
         * @description Selects an eligible provider and model for the authenticated workspace without executing it.
         */
        post: operations["AiController_resolveRoute_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/invocations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List provider executions
         * @description Returns filtered, paginated, workspace-isolated provider execution records.
         */
        get: operations["AiController_listInvocations_v1"];
        put?: never;
        /**
         * Invoke AI
         * @description Executes a synchronous provider-neutral AI invocation in the authenticated workspace.
         */
        post: operations["AiController_invoke_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/custom-providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List workspace Custom Providers */
        get: operations["CustomProviderController_list_v1"];
        put?: never;
        /** Register a workspace Custom Provider */
        post: operations["CustomProviderController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/custom-providers/{providerId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a workspace Custom Provider */
        get: operations["CustomProviderController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update allowed Custom Provider definition fields */
        patch: operations["CustomProviderController_update_v1"];
        trace?: never;
    };
    "/api/v1/ai/custom-providers/{providerId}/enable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enable a configured Custom Provider */
        post: operations["CustomProviderController_enable_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/custom-providers/{providerId}/disable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Disable a Custom Provider */
        post: operations["CustomProviderController_disable_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/custom-providers/{providerId}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive a Custom Provider */
        post: operations["CustomProviderController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/custom-providers/{providerId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore an archived Custom Provider */
        post: operations["CustomProviderController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/custom-providers/{providerId}/credentials": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List safe Custom Provider credential metadata */
        get: operations["CustomProviderController_listCredentials_v1"];
        /** Create or replace a write-only Custom Provider credential */
        put: operations["CustomProviderController_replaceCredential_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/custom-providers/{providerId}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Test connection to a saved Custom Provider */
        post: operations["CustomProviderController_validate_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ModelCatalogController_list_v1"];
        put?: never;
        post: operations["ModelCatalogController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/models/{modelId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ModelCatalogController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["ModelCatalogController_update_v1"];
        trace?: never;
    };
    "/api/v1/ai/models/{modelId}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ModelCatalogController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/models/{modelId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ModelCatalogController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard-runtime/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resolve the renderer-neutral dashboard bootstrap manifest */
        get: operations["DashboardRuntimeController_bootstrap_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List workspace studio projects */
        get: operations["StudioProjectController_list_v1"];
        put?: never;
        /** Create a studio project draft */
        post: operations["StudioProjectController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/projects/{projectId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a studio project */
        get: operations["StudioProjectController_get_v1"];
        /** Update a studio project draft */
        put: operations["StudioProjectController_update_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/projects/{projectId}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get immutable project revision history */
        get: operations["StudioProjectController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/projects/{projectId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish an immutable studio project revision */
        post: operations["StudioProjectController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/projects/{projectId}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new published revision from a prior revision */
        post: operations["StudioProjectController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/projects/{projectId}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive a studio project */
        post: operations["StudioProjectController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search and paginate workspace prompts */
        get: operations["PromptLibraryController_list_v1"];
        put?: never;
        /** Create a prompt draft */
        post: operations["PromptLibraryController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List workspace prompt categories */
        get: operations["PromptLibraryController_categories_v1"];
        put?: never;
        /** Create a workspace prompt category */
        post: operations["PromptLibraryController_createCategory_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a workspace prompt category */
        put: operations["PromptLibraryController_updateCategory_v1"];
        post?: never;
        /** Delete an unused workspace prompt category */
        delete: operations["PromptLibraryController_deleteCategory_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List workspace prompt tags */
        get: operations["PromptLibraryController_tags_v1"];
        put?: never;
        /** Create a workspace prompt tag */
        post: operations["PromptLibraryController_createTag_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a workspace prompt tag */
        put: operations["PromptLibraryController_updateTag_v1"];
        post?: never;
        /** Delete an unused workspace prompt tag */
        delete: operations["PromptLibraryController_deleteTag_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a workspace prompt */
        get: operations["PromptLibraryController_get_v1"];
        /** Edit a prompt draft */
        put: operations["PromptLibraryController_update_v1"];
        post?: never;
        /** Delete an unreferenced prompt draft */
        delete: operations["PromptLibraryController_delete_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get immutable published prompt history */
        get: operations["PromptLibraryController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/{id}/metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Edit prompt variable metadata and metadata while in draft */
        patch: operations["PromptLibraryController_updateMetadata_v1"];
        trace?: never;
    };
    "/api/v1/prompt-library/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish an immutable prompt version */
        post: operations["PromptLibraryController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/{id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new published version from a prior version */
        post: operations["PromptLibraryController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/{id}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clone a prompt into a new independent draft */
        post: operations["PromptLibraryController_clone_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Soft-delete a prompt without deleting version history */
        post: operations["PromptLibraryController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore an archived prompt */
        post: operations["PromptLibraryController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/{id}/favorite": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Set prompt favorite state */
        put: operations["PromptLibraryController_favorite_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-library/{id}/tags/{tagId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Assign a workspace tag to a draft prompt */
        post: operations["PromptLibraryController_assignTag_v1"];
        /** Remove a workspace tag from a draft prompt */
        delete: operations["PromptLibraryController_removeTag_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List workspace Agent Studio agents */
        get: operations["AgentStudioController_list_v1"];
        put?: never;
        /** Create an Agent Studio draft */
        post: operations["AgentStudioController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an Agent Studio agent */
        get: operations["AgentStudioController_get_v1"];
        /** Update an Agent Studio draft */
        put: operations["AgentStudioController_update_v1"];
        post?: never;
        /** Soft-delete an Agent Studio agent without deleting history */
        delete: operations["AgentStudioController_delete_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get immutable Agent Studio version history */
        get: operations["AgentStudioController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/operational-personality": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update live operational personality controls without changing the Agent definition */
        put: operations["AgentStudioController_updateOperationalPersonality_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/conversation-history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update the Agent's conversation-history working-context control without changing the Agent definition */
        put: operations["AgentStudioController_updateConversationHistory_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/automatic-execution": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Pause or resume automatic execution for one Agent */
        put: operations["AgentStudioController_updateAutomaticExecution_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish an immutable Agent Studio version */
        post: operations["AgentStudioController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new published version from a prior Agent Studio version */
        post: operations["AgentStudioController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clone an agent into an independent draft */
        post: operations["AgentStudioController_clone_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive an Agent Studio agent while retaining history */
        post: operations["AgentStudioController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore an archived or soft-deleted Agent Studio agent */
        post: operations["AgentStudioController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/channels/{connectionId}/switch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bind a published, runtime-ready agent to a channel connection */
        post: operations["AgentStudioController_switch_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-studio/agents/{agentId}/retrieval-runtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bind a published RetrievalRuntime to an agent */
        post: operations["AgentStudioController_bindRetrievalRuntime_v1"];
        /** Unbind the RetrievalRuntime from an agent */
        delete: operations["AgentStudioController_unbindRetrievalRuntime_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-runtime/runtimes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate prepared Agent Runtime records */
        get: operations["AgentRuntimeController_list_v1"];
        put?: never;
        /** Resolve and persist an Agent Runtime preparation without invoking a provider */
        post: operations["AgentRuntimeController_prepare_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-runtime/runtimes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load Agent Runtime preparation, conversation metadata, and snapshot reference */
        get: operations["AgentRuntimeController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-runtime/runtimes/{id}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revalidate runtime readiness against current workspace configuration */
        post: operations["AgentRuntimeController_validate_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-runtime/runtimes/{id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Resolve a prepared runtime without executing or mutating it */
        post: operations["AgentRuntimeController_resolve_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-runtime/runtimes/{id}/snapshot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create the immutable Provider Runtime handoff snapshot */
        post: operations["AgentRuntimeController_snapshot_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-runtime/snapshots/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an immutable Agent Runtime snapshot */
        get: operations["AgentRuntimeController_getSnapshot_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-compiler/compile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Compile and persist an immutable prompt package without provider execution */
        post: operations["PromptCompilerController_compile_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-compiler/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Compile an audited, non-persisted prompt package preview */
        post: operations["PromptCompilerController_preview_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-compiler/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Validate prompt sources, variables, dependencies, and size metadata */
        post: operations["PromptCompilerController_validate_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-compiler/compiled": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate immutable compiled prompt records */
        get: operations["PromptCompilerController_list_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-compiler/compiled/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an immutable compiled prompt package */
        get: operations["PromptCompilerController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-compiler/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Compare two workspace-isolated compiled prompt versions */
        get: operations["PromptCompilerController_compare_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-executions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate immutable prompt execution payloads */
        get: operations["PromptExecutionController_list_v1"];
        put?: never;
        /** Render and persist an immutable provider-ready prompt payload */
        post: operations["PromptExecutionController_render_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-executions/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Validate prompt execution without persisting a payload */
        post: operations["PromptExecutionController_validate_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-executions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an immutable prompt execution payload */
        get: operations["PromptExecutionController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/provider-runtime/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate workspace provider requests */
        get: operations["ProviderRuntimeController_listRequests_v1"];
        put?: never;
        /** Prepare an immutable, vendor-neutral provider request without execution */
        post: operations["ProviderRuntimeController_prepare_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/provider-runtime/requests/{id}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revalidate a prepared provider request against its resolved sources */
        post: operations["ProviderRuntimeController_validate_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/provider-runtime/requests/{id}/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create an immutable versioned provider request snapshot */
        post: operations["ProviderRuntimeController_createSnapshot_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/provider-runtime/requests/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load a workspace-isolated prepared provider request */
        get: operations["ProviderRuntimeController_getRequest_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/provider-runtime/snapshots/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Compare two immutable provider request snapshots */
        get: operations["ProviderRuntimeController_compare_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/provider-runtime/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate immutable provider request snapshots */
        get: operations["ProviderRuntimeController_listSnapshots_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/provider-runtime/snapshots/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an immutable provider request snapshot */
        get: operations["ProviderRuntimeController_getSnapshot_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate workspace execution pipelines */
        get: operations["ExecutionPipelineController_list_v1"];
        put?: never;
        /** Assemble a metadata-only execution plan draft */
        post: operations["ExecutionPipelineController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an execution pipeline and revision history */
        get: operations["ExecutionPipelineController_get_v1"];
        put?: never;
        post?: never;
        /** Soft-delete a pipeline while preserving history */
        delete: operations["ExecutionPipelineController_softDelete_v1"];
        options?: never;
        head?: never;
        /** Update an execution pipeline draft */
        patch: operations["ExecutionPipelineController_update_v1"];
        trace?: never;
    };
    "/api/v1/execution-pipelines/{id}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Validate graph, dependencies, compatibility, and snapshot integrity */
        post: operations["ExecutionPipelineController_validate_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish an immutable execution plan snapshot and revision */
        post: operations["ExecutionPipelineController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines/{id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new published revision from immutable history */
        post: operations["ExecutionPipelineController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines/{id}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clone an execution pipeline with new persistence identities */
        post: operations["ExecutionPipelineController_clone_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive a pipeline while preserving immutable history */
        post: operations["ExecutionPipelineController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore archived or soft-deleted pipeline metadata */
        post: operations["ExecutionPipelineController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines/snapshots/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Compare immutable execution plan snapshots */
        get: operations["ExecutionPipelineController_compare_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate immutable execution plan snapshots */
        get: operations["ExecutionPipelineController_listSnapshots_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-pipelines/snapshots/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an immutable execution plan snapshot */
        get: operations["ExecutionPipelineController_getSnapshot_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate workspace execution requests */
        get: operations["ExecutionKernelController_listRequests_v1"];
        put?: never;
        /** Create an idempotent execution request without executing it */
        post: operations["ExecutionKernelController_createRequest_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/requests/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get execution request history and associated runs */
        get: operations["ExecutionKernelController_getRequest_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/requests/{id}/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a requested execution run without starting execution */
        post: operations["ExecutionKernelController_createRun_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate execution runs */
        get: operations["ExecutionKernelController_listRuns_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/runs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get run lifecycle, steps, append-only events, and structured logs */
        get: operations["ExecutionKernelController_getRun_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/runs/{id}/transition": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Transactionally transition execution lifecycle state */
        post: operations["ExecutionKernelController_transition_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/runs/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record a transactional cancellation request */
        post: operations["ExecutionKernelController_cancel_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/runs/{id}/failure": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record terminal failure information and lifecycle event */
        post: operations["ExecutionKernelController_recordFailure_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/runs/{id}/steps": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Append an ordered immutable execution step record */
        post: operations["ExecutionKernelController_recordStep_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/runs/{id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Append a diagnostic event to the immutable execution timeline */
        post: operations["ExecutionKernelController_appendEvent_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-kernel/runs/{id}/logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Append a structured execution log record */
        post: operations["ExecutionKernelController_appendLog_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-executions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate agent execution plans */
        get: operations["AgentExecutionController_list_v1"];
        put?: never;
        /** Coordinate immutable runtime assets into an agent execution plan */
        post: operations["AgentExecutionController_prepare_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-executions/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel a coordinated agent execution through Execution Kernel */
        post: operations["AgentExecutionController_cancel_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-executions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an immutable agent execution plan */
        get: operations["AgentExecutionController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-execution/execute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Execute a validated immutable agent runtime plan */
        post: operations["UnifiedAgentExecutionController_execute_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-execution/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start a real provider stream backed by immutable runtime assets */
        post: operations["UnifiedAgentExecutionController_stream_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-execution/stream/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Cancel an active provider stream */
        delete: operations["UnifiedAgentExecutionController_cancelStream_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-execution/stream/{sessionId}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Receive incremental provider stream events over SSE */
        get: operations["UnifiedAgentExecutionController_events_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate workspace conversation runtime records */
        get: operations["ConversationRuntimeController_list_v1"];
        put?: never;
        /** Prepare normalized conversation runtime metadata without AI execution */
        post: operations["ConversationRuntimeController_prepare_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/{id}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Validate normalized conversation metadata and snapshot integrity */
        post: operations["ConversationRuntimeController_validate_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/{id}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Apply a validated conversation metadata state transition */
        post: operations["ConversationRuntimeController_transition_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish immutable conversation snapshot and version records */
        post: operations["ConversationRuntimeController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/{id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rollback by creating a new published revision from immutable history */
        post: operations["ConversationRuntimeController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/{id}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clone conversation metadata with entirely new persistence identities */
        post: operations["ConversationRuntimeController_clone_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive conversation runtime without deleting revision history */
        post: operations["ConversationRuntimeController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore archived or soft-deleted conversation runtime metadata */
        post: operations["ConversationRuntimeController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load normalized conversation runtime metadata and history */
        get: operations["ConversationRuntimeController_get_v1"];
        put?: never;
        post?: never;
        /** Soft-delete conversation runtime while preserving immutable history */
        delete: operations["ConversationRuntimeController_softDelete_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/snapshots/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Compare immutable conversation runtime snapshots */
        get: operations["ConversationRuntimeController_compare_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate immutable conversation runtime snapshots */
        get: operations["ConversationRuntimeController_listSnapshots_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversation-runtime/snapshots/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an immutable conversation runtime snapshot */
        get: operations["ConversationRuntimeController_getSnapshot_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-optimizations/compiled-prompts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cache or reuse an immutable compiled prompt package */
        post: operations["RuntimeOptimizationController_cacheCompiled_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-optimizations/rendered-prompts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cache deterministic static prompt rendering only */
        post: operations["RuntimeOptimizationController_cacheRendered_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-optimizations/runtime-contexts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create or reuse a complete immutable runtime context snapshot */
        post: operations["RuntimeOptimizationController_createContext_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-optimizations/retrieval-packages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cache deterministic query-independent retrieval preparation */
        post: operations["RuntimeOptimizationController_cacheRetrieval_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-optimizations/immutable-packages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cache or reuse a hash-protected immutable runtime package */
        post: operations["RuntimeOptimizationController_cacheImmutable_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-optimizations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an immutable optimization package */
        get: operations["RuntimeOptimizationController_get_v1"];
        put?: never;
        post?: never;
        /** Invalidate an immutable cache package using optimistic locking */
        delete: operations["RuntimeOptimizationController_invalidate_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-optimizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate immutable optimization packages */
        get: operations["RuntimeOptimizationController_list_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-optimizations/{id}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load aggregated optimization reuse metrics */
        get: operations["RuntimeOptimizationController_metrics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/stream-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate stream sessions */
        get: operations["StreamingRuntimeController_list_v1"];
        put?: never;
        /** Create immutable streaming session */
        post: operations["StreamingRuntimeController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/stream-sessions/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel a stream and propagate lifecycle cancellation */
        post: operations["StreamingRuntimeController_cancel_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/stream-sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load stream session */
        get: operations["StreamingRuntimeController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/stream-sessions/{id}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load stream metrics */
        get: operations["StreamingRuntimeController_metrics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/stream-sessions/{id}/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load stream diagnostics */
        get: operations["StreamingRuntimeController_diagnostics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/stream-sessions/{id}/chunks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load immutable ordered stream chunks */
        get: operations["StreamingRuntimeController_chunks_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/stream-sessions/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Compare immutable stream snapshots */
        post: operations["StreamingRuntimeController_compare_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/stream-sessions/{id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["StreamingRuntimeController_events_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MemoryRuntimeController_list_v1"];
        put?: never;
        /** Create workspace-isolated memory runtime metadata */
        post: operations["MemoryRuntimeController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MemoryRuntimeController_get_v1"];
        put: operations["MemoryRuntimeController_update_v1"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MemoryRuntimeController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/{id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MemoryRuntimeController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MemoryRuntimeController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MemoryRuntimeController_resolve_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/writes/commit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MemoryRuntimeController_commit_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/snapshots/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MemoryRuntimeController_compare_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MemoryRuntimeController_snapshots_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/snapshots/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MemoryRuntimeController_snapshot_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/{id}/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MemoryRuntimeController_diagnostics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/{id}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MemoryRuntimeController_metrics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memory-runtime/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MemoryRuntimeController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-executions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate workspace retrieval executions */
        get: operations["RetrievalExecutionController_list_v1"];
        put?: never;
        /** Execute an immutable retrieval snapshot into prompt-ready context */
        post: operations["RetrievalExecutionController_execute_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-executions/{id}/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["RetrievalExecutionController_diagnostics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-executions/{id}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["RetrievalExecutionController_metrics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-executions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["RetrievalExecutionController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-runtime/executions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate immutable tool invocation history */
        get: operations["ToolRuntimeController_list_v1"];
        put?: never;
        /** Execute a hash-verified immutable tool version */
        post: operations["ToolRuntimeController_execute_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-runtime/executions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ToolRuntimeController_get_v1"];
        put?: never;
        post?: never;
        /** Cancel an active tool execution and its Execution Kernel run */
        delete: operations["ToolRuntimeController_cancel_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-runtime/executions/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ToolRuntimeController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-runtime/executions/{id}/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ToolRuntimeController_diagnostics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-runtime/executions/{id}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ToolRuntimeController_metrics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-runtime/executions/{id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ToolRuntimeController_persistedEvents_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-runtime/executions/{id}/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Receive tool progress, partial-output, and terminal events over SSE */
        get: operations["ToolRuntimeController_stream_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List tool categories */
        get: operations["ToolRegistryController_categories_v1"];
        put?: never;
        /** Create a tool category */
        post: operations["ToolRegistryController_createCategory_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a tool category */
        put: operations["ToolRegistryController_updateCategory_v1"];
        post?: never;
        /** Delete an unused tool category */
        delete: operations["ToolRegistryController_deleteCategory_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List tool groups */
        get: operations["ToolRegistryController_groups_v1"];
        put?: never;
        /** Create a tool group */
        post: operations["ToolRegistryController_createGroup_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/groups/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a tool group */
        put: operations["ToolRegistryController_updateGroup_v1"];
        post?: never;
        /** Delete an unused tool group */
        delete: operations["ToolRegistryController_deleteGroup_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/tools": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search and paginate tool definitions */
        get: operations["ToolRegistryController_list_v1"];
        put?: never;
        /** Create a tool definition draft */
        post: operations["ToolRegistryController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/tools/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a tool definition */
        get: operations["ToolRegistryController_get_v1"];
        /** Update tool definition draft metadata */
        put: operations["ToolRegistryController_update_v1"];
        post?: never;
        /** Soft-delete a tool without deleting version history */
        delete: operations["ToolRegistryController_delete_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/tools/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get immutable tool version history */
        get: operations["ToolRegistryController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/tools/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish an immutable tool definition revision */
        post: operations["ToolRegistryController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/tools/{id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new published revision from prior tool metadata */
        post: operations["ToolRegistryController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/tools/{id}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clone a tool into an independent draft */
        post: operations["ToolRegistryController_clone_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/tools/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive a tool without deleting version history */
        post: operations["ToolRegistryController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tool-registry/tools/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore an archived or soft-deleted tool */
        post: operations["ToolRegistryController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-runtime/executions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate workspace workflow executions */
        get: operations["WorkflowRuntimeController_list_v1"];
        put?: never;
        /** Execute a hash-verified immutable workflow version */
        post: operations["WorkflowRuntimeController_execute_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-runtime/executions/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel a running or waiting workflow through the Execution Kernel */
        post: operations["WorkflowRuntimeController_cancel_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-runtime/executions/{id}/approval": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Resolve an approval node and resume or fail the workflow */
        post: operations["WorkflowRuntimeController_approve_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-runtime/executions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get execution context, node timeline, diagnostics, and metrics */
        get: operations["WorkflowRuntimeController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-runtime/executions/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["WorkflowRuntimeController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-runtime/executions/{id}/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["WorkflowRuntimeController_diagnostics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-runtime/executions/{id}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["WorkflowRuntimeController_metrics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-runtime": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate workspace retrieval packages */
        get: operations["RetrievalRuntimeController_list_v1"];
        put?: never;
        /** Prepare immutable retrieval metadata without search or execution */
        post: operations["RetrievalRuntimeController_prepare_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-runtime/{id}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Validate prepared metadata against current published Knowledge assets */
        post: operations["RetrievalRuntimeController_validate_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-runtime/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish an immutable versioned retrieval snapshot */
        post: operations["RetrievalRuntimeController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-runtime/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive retrieval metadata without deleting snapshot history */
        post: operations["RetrievalRuntimeController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-runtime/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore archived retrieval metadata and preserve history */
        post: operations["RetrievalRuntimeController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-runtime/snapshots/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Compare two immutable retrieval snapshots */
        get: operations["RetrievalRuntimeController_compare_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-runtime/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Filter and paginate immutable retrieval snapshots */
        get: operations["RetrievalRuntimeController_listSnapshots_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-runtime/snapshots/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load an immutable retrieval snapshot */
        get: operations["RetrievalRuntimeController_getSnapshot_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retrieval-runtime/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Load a workspace-isolated retrieval package and diagnostics */
        get: operations["RetrievalRuntimeController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/spaces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List knowledge spaces */
        get: operations["KnowledgeBaseController_spaces_v1"];
        put?: never;
        /** Create a knowledge space */
        post: operations["KnowledgeBaseController_createSpace_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/spaces/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a knowledge space */
        put: operations["KnowledgeBaseController_updateSpace_v1"];
        post?: never;
        /** Soft-delete an empty knowledge space */
        delete: operations["KnowledgeBaseController_deleteSpace_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/spaces/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish all indexed knowledge documents in a space */
        post: operations["KnowledgeBaseController_publishSpace_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/collections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List knowledge collections */
        get: operations["KnowledgeBaseController_collections_v1"];
        put?: never;
        /** Create a knowledge collection */
        post: operations["KnowledgeBaseController_createCollection_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/collections/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a knowledge collection */
        put: operations["KnowledgeBaseController_updateCollection_v1"];
        post?: never;
        /** Soft-delete an empty knowledge collection */
        delete: operations["KnowledgeBaseController_deleteCollection_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/folders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List knowledge folders */
        get: operations["KnowledgeBaseController_folders_v1"];
        put?: never;
        /** Create a knowledge folder */
        post: operations["KnowledgeBaseController_createFolder_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/folders/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a knowledge folder and validate hierarchy */
        put: operations["KnowledgeBaseController_updateFolder_v1"];
        post?: never;
        /** Soft-delete an empty knowledge folder */
        delete: operations["KnowledgeBaseController_deleteFolder_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List knowledge categories */
        get: operations["KnowledgeBaseController_categories_v1"];
        put?: never;
        /** Create a knowledge category */
        post: operations["KnowledgeBaseController_createCategory_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a knowledge category */
        put: operations["KnowledgeBaseController_updateCategory_v1"];
        post?: never;
        /** Delete an unused knowledge category */
        delete: operations["KnowledgeBaseController_deleteCategory_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List knowledge tags */
        get: operations["KnowledgeBaseController_tags_v1"];
        put?: never;
        /** Create a knowledge tag */
        post: operations["KnowledgeBaseController_createTag_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a knowledge tag */
        put: operations["KnowledgeBaseController_updateTag_v1"];
        post?: never;
        /** Delete an unused knowledge tag */
        delete: operations["KnowledgeBaseController_deleteTag_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search and paginate knowledge document metadata */
        get: operations["KnowledgeBaseController_documents_v1"];
        put?: never;
        /** Create a knowledge document draft */
        post: operations["KnowledgeBaseController_createDocument_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a knowledge document */
        get: operations["KnowledgeBaseController_document_v1"];
        /** Update knowledge document draft metadata */
        put: operations["KnowledgeBaseController_updateDocument_v1"];
        post?: never;
        /** Soft-delete a knowledge document without removing versions */
        delete: operations["KnowledgeBaseController_deleteDocument_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get immutable knowledge document history */
        get: operations["KnowledgeBaseController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upload a knowledge document file and process it into indexed chunks */
        post: operations["KnowledgeBaseController_uploadDocument_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents/text": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a knowledge document from raw text and process it into indexed chunks */
        post: operations["KnowledgeBaseController_createTextDocument_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish an immutable knowledge document revision */
        post: operations["KnowledgeBaseController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents/{id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new published revision from prior knowledge metadata */
        post: operations["KnowledgeBaseController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents/{id}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clone a knowledge document into an independent draft */
        post: operations["KnowledgeBaseController_clone_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive a knowledge document while retaining history */
        post: operations["KnowledgeBaseController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/knowledge-base/documents/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore an archived or soft-deleted knowledge document */
        post: operations["KnowledgeBaseController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List workflow categories */
        get: operations["WorkflowEngineController_categories_v1"];
        put?: never;
        /** Create a workflow category */
        post: operations["WorkflowEngineController_createCategory_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a workflow category */
        put: operations["WorkflowEngineController_updateCategory_v1"];
        post?: never;
        /** Delete an unused workflow category */
        delete: operations["WorkflowEngineController_deleteCategory_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List workflow tags */
        get: operations["WorkflowEngineController_tags_v1"];
        put?: never;
        /** Create a workflow tag */
        post: operations["WorkflowEngineController_createTag_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a workflow tag */
        put: operations["WorkflowEngineController_updateTag_v1"];
        post?: never;
        /** Delete an unused workflow tag */
        delete: operations["WorkflowEngineController_deleteTag_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/workflows": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search, filter, sort, and paginate workflow definitions */
        get: operations["WorkflowEngineController_list_v1"];
        put?: never;
        /** Create a workflow definition draft */
        post: operations["WorkflowEngineController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/workflows/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a workspace-isolated workflow draft and graph */
        get: operations["WorkflowEngineController_get_v1"];
        /** Update workflow draft metadata and topology */
        put: operations["WorkflowEngineController_update_v1"];
        post?: never;
        /** Soft-delete a workflow while retaining immutable history */
        delete: operations["WorkflowEngineController_delete_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/workflows/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get immutable workflow version history */
        get: operations["WorkflowEngineController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/workflows/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish an immutable workflow snapshot */
        post: operations["WorkflowEngineController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/workflows/{id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new published revision from a prior immutable snapshot */
        post: operations["WorkflowEngineController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/workflows/{id}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clone workflow metadata and topology into an independent draft */
        post: operations["WorkflowEngineController_clone_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/workflows/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive a workflow without removing graph or version history */
        post: operations["WorkflowEngineController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflow-engine/workflows/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore an archived or soft-deleted workflow */
        post: operations["WorkflowEngineController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/queues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List queue metadata definitions */
        get: operations["RuntimeOrchestrationController_queues_v1"];
        put?: never;
        /** Create queue metadata without provisioning a queue */
        post: operations["RuntimeOrchestrationController_createQueue_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/queues/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update queue metadata */
        put: operations["RuntimeOrchestrationController_updateQueue_v1"];
        post?: never;
        /** Delete unused queue metadata */
        delete: operations["RuntimeOrchestrationController_deleteQueue_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/priorities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List priority level metadata */
        get: operations["RuntimeOrchestrationController_priorities_v1"];
        put?: never;
        /** Create a validated priority level */
        post: operations["RuntimeOrchestrationController_createPriority_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/priorities/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update a priority level */
        put: operations["RuntimeOrchestrationController_updatePriority_v1"];
        post?: never;
        /** Delete an unused priority level */
        delete: operations["RuntimeOrchestrationController_deletePriority_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List execution tags */
        get: operations["RuntimeOrchestrationController_tags_v1"];
        put?: never;
        /** Create an execution tag */
        post: operations["RuntimeOrchestrationController_createTag_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update an execution tag */
        put: operations["RuntimeOrchestrationController_updateTag_v1"];
        post?: never;
        /** Delete an unused execution tag */
        delete: operations["RuntimeOrchestrationController_deleteTag_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/profiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search, filter, sort, and paginate execution profiles */
        get: operations["RuntimeOrchestrationController_list_v1"];
        put?: never;
        /** Create an execution profile draft */
        post: operations["RuntimeOrchestrationController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/profiles/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an execution profile and orchestration metadata */
        get: operations["RuntimeOrchestrationController_get_v1"];
        /** Update an execution profile draft */
        put: operations["RuntimeOrchestrationController_update_v1"];
        post?: never;
        /** Soft-delete an execution profile while retaining history */
        delete: operations["RuntimeOrchestrationController_delete_v1"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/profiles/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get immutable execution profile history */
        get: operations["RuntimeOrchestrationController_history_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/profiles/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish an immutable orchestration metadata snapshot */
        post: operations["RuntimeOrchestrationController_publish_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/profiles/{id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new published revision from an earlier snapshot */
        post: operations["RuntimeOrchestrationController_rollback_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/profiles/{id}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clone orchestration metadata into an independent draft */
        post: operations["RuntimeOrchestrationController_clone_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/profiles/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive an execution profile without deleting history */
        post: operations["RuntimeOrchestrationController_archive_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime-orchestration/profiles/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore an archived or soft-deleted execution profile */
        post: operations["RuntimeOrchestrationController_restore_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_list_v1"];
        put?: never;
        /** Create an immutable workspace channel runtime */
        post: operations["ChannelRuntimeController_create_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/channels/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_get_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_providers_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/providers/{providerKey}/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_capabilities_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/providers/{providerKey}/capabilities/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ChannelRuntimeController_refreshCapabilities_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/channels/{id}/provider-connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a vendor-neutral provider connection */
        post: operations["ChannelRuntimeController_providerConnection_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/channels/{id}/connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_connections_v1"];
        put?: never;
        /** Create an encrypted Meta WhatsApp Cloud connection */
        post: operations["ChannelRuntimeController_connection_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/phone-numbers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_phoneNumbers_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ChannelRuntimeController_health_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_connectionDiagnostics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/reconnect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ChannelRuntimeController_reconnect_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/disconnect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ChannelRuntimeController_disconnect_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/new-pairing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ChannelRuntimeController_newPairing_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/configurations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_configurations_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["ChannelRuntimeController_updateConnection_v1"];
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/configuration": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["ChannelRuntimeController_updateConfiguration_v1"];
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["ChannelRuntimeController_connectionState_v1"];
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/credentials/rotate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rotate an encrypted channel credential using optimistic versioning */
        post: operations["ChannelRuntimeController_rotateCredential_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/batches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_batches_v1"];
        put?: never;
        post: operations["ChannelRuntimeController_createBatch_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/connections/{id}/verify-token/regenerate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Regenerate webhook verify token */
        post: operations["ChannelRuntimeController_regenerateVerifyToken_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/webhooks/whatsapp/{pathKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Verify a Meta WhatsApp webhook subscription */
        get: operations["ChannelRuntimeController_verify_v1"];
        put?: never;
        post: operations["ChannelRuntimeController_webhook_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/webhooks/{providerKey}/{pathKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_verifyProvider_v1"];
        put?: never;
        post: operations["ChannelRuntimeController_providerWebhook_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/channels/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Queue-ready provider-neutral outbound channel message */
        post: operations["ChannelRuntimeController_send_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/messages/{id}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["ChannelRuntimeController_transition_v1"];
        trace?: never;
    };
    "/api/v1/channel-runtime/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_messages_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/messages/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_message_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_attachments_v1"];
        put?: never;
        post: operations["ChannelRuntimeController_upload_v1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/attachments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_attachment_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_conversations_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/conversations/{id}/agent-execution": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Enable or disable automatic Responix execution for one channel conversation */
        patch: operations["ChannelRuntimeController_setConversationExecution_v1"];
        trace?: never;
    };
    "/api/v1/channel-runtime/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_diagnostics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/channel-runtime/channels/{id}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ChannelRuntimeController_metrics_v1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AuthUserDto: {
            /** Format: uuid */
            id: string;
            /** Format: email */
            email: string;
            fullName: string;
            /** Format: uuid */
            workspaceId: string;
            permissions: string[];
        };
        AuthWorkspaceDto: {
            /** Format: uuid */
            id: string;
            name: string;
            slug: string;
            /** @enum {string} */
            status: "ACTIVE";
        };
        AuthSuccessResponseDto: {
            accessToken: string;
            /**
             * @description Access-token lifetime in seconds
             * @example 900
             */
            expiresIn: number;
            user: components["schemas"]["AuthUserDto"];
            workspace: components["schemas"]["AuthWorkspaceDto"];
        };
        WorkspaceSelectionRequiredResponseDto: {
            /** @enum {boolean} */
            requiresWorkspaceSelection: true;
            selectionToken: string;
            /** @example 300 */
            expiresIn: number;
            workspaces: components["schemas"]["AuthWorkspaceDto"][];
        };
        LoginDto: {
            /** @example user@example.com */
            email: string;
            /** Format: password */
            password: string;
        };
        AuthErrorResponseDto: {
            /** @example 401 */
            statusCode: number;
            /** @example Invalid credentials */
            message: string | string[];
            requestId?: string;
        };
        WorkspaceSelectionDto: {
            /** @description Short-lived token returned after credential verification */
            selectionToken: string;
            /** Format: uuid */
            workspaceId: string;
        };
        SwitchWorkspaceDto: {
            /** Format: uuid */
            workspaceId: string;
        };
        LogoutResponseDto: {
            /** @enum {string} */
            status: "ok";
        };
        PlatformCurrentResponseDto: {
            permissions: string[];
            features: string[];
            license: {
                [key: string]: unknown;
            };
            branding: {
                [key: string]: unknown;
            };
            manifest: {
                [key: string]: unknown;
            };
        };
        UpdateBrandingDto: {
            appName?: string;
            accentColor?: string;
            darkTheme?: {
                [key: string]: unknown;
            };
            lightTheme?: {
                [key: string]: unknown;
            };
            fonts?: {
                [key: string]: unknown;
            };
            icons?: {
                [key: string]: unknown;
            };
            faviconMetadata?: {
                [key: string]: unknown;
            };
            emailBranding?: {
                [key: string]: unknown;
            };
            loginBackground?: string;
            dashboardStyle?: {
                [key: string]: unknown;
            };
            locale?: string;
            dateFormat?: string;
            timeFormat?: string;
            /** @enum {string} */
            direction?: "LTR" | "RTL";
        };
        UpdateFeatureDto: {
            /** @example crm */
            key: string;
            /** @enum {string} */
            state: "ENABLED" | "DISABLED" | "HIDDEN";
            experimental?: boolean;
            dependencies?: string[];
            metadata?: {
                [key: string]: unknown;
            };
        };
        UpdatePermissionOverrideDto: {
            permissionCode: string;
            /** @enum {string} */
            effect: "GRANT" | "REVOKE";
            /** Format: uuid */
            userId?: string;
        };
        CreateRoleDto: {
            name: string;
            description?: string;
            priority?: number;
            parentRoleIds?: string[];
        };
        UpdateRoleDto: {
            name?: string;
            description?: string;
            priority?: number;
            parentRoleIds?: string[];
        };
        TemporaryRoleDto: {
            /** Format: uuid */
            userId: string;
            /** Format: uuid */
            roleId: string;
            startAt: string;
            expiresAt?: string;
        };
        TemporaryPermissionDto: {
            /** Format: uuid */
            userId: string;
            permissionCode: string;
            /** @enum {string} */
            effect: "GRANT" | "REVOKE";
            startAt: string;
            expiresAt?: string;
        };
        UpdateManifestDto: {
            /** @example 1.0 */
            schemaVersion: string;
            /** @example 1.0 */
            compatibilityVersion: string;
            manifest: {
                [key: string]: unknown;
            };
            migrationMetadata?: {
                [key: string]: unknown;
            };
        };
        CreateWorkspaceDto: Record<string, never>;
        WorkspaceResponseDto: {
            /** Format: uuid */
            id: string;
            name: string;
            slug: string;
            companyName?: Record<string, never> | null;
            /** Format: uuid */
            ownerId: string;
            logoUrl?: Record<string, never> | null;
            primaryColor?: Record<string, never> | null;
            secondaryColor?: Record<string, never> | null;
            country?: Record<string, never> | null;
            language: string;
            timezone: string;
            currency: string;
            /** Format: uuid */
            subscriptionId?: Record<string, never> | null;
            /** Format: uuid */
            planId?: Record<string, never> | null;
            /** @enum {string} */
            status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
            maxUsers: number;
            maxAgents: number;
            maxMessages: number;
            maxStorage: number;
            maxTokens: number;
            currentStorageUsage: number;
            currentTokenUsage: number;
            aiEnabled: boolean;
            whatsappEnabled: boolean;
            emailEnabled: boolean;
            apiEnabled: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        UpdateWorkspaceDto: Record<string, never>;
        InviteMemberDto: Record<string, never>;
        InvitationTokenDto: Record<string, never>;
        UpdateMemberRoleDto: Record<string, never>;
        AiModelResponseDto: {
            modelId: string;
            modelName: string;
            displayName: string;
            version?: string;
            /** @enum {string} */
            status: "ACTIVE" | "DISABLED" | "DEPRECATED";
            priority: number;
            contextWindow: number;
            maxOutputTokens?: number;
            supportsVision: boolean;
            supportsAudio: boolean;
            supportsTools: boolean;
            supportsReasoning: boolean;
            supportsStreaming: boolean;
            supportsFunctionCalling: boolean;
            supportsVideo: boolean;
            supportsMcp: boolean;
            categories: string[];
        };
        AiProviderResponseDto: {
            id: string;
            providerName: string;
            /** @enum {string} */
            status: "ACTIVE" | "DISABLED" | "UNHEALTHY";
            priority: number;
            configured: boolean;
            providerConfigurationId?: string;
            credentialConfigured: boolean;
            enabled: boolean;
            models: components["schemas"]["AiModelResponseDto"][];
        };
        ProviderConfigurationResponseDto: {
            providerId: string;
            providerName: string;
            configured: boolean;
            enabled: boolean;
            credentialConfigured: boolean;
            settings: {
                [key: string]: unknown;
            };
            updatedAt?: string;
            lastValidatedAt?: string;
            available?: boolean;
            errorCode?: string;
        };
        ProviderSettingsDto: {
            /** @description Workspace-specific HTTPS provider endpoint */
            apiBaseUrl?: string;
        };
        ProviderCredentialInputDto: {
            /** @default default */
            name: string;
            secret: string;
        };
        ConfigureProviderDto: {
            enabled: boolean;
            settings?: components["schemas"]["ProviderSettingsDto"];
            credential?: components["schemas"]["ProviderCredentialInputDto"];
            /** @description Current configuration updatedAt value for optimistic concurrency */
            expectedUpdatedAt?: string;
        };
        ProviderValidationResponseDto: {
            providerId: string;
            available: boolean;
            checkedAt: string;
            latencyMs?: number;
            errorCode?: string;
        };
        AiRoutingRequestDto: {
            minimumContextWindow?: number;
            minimumOutputTokens?: number;
            vision?: boolean;
            audio?: boolean;
            tools?: boolean;
            reasoning?: boolean;
            /** @description Requires a model with streaming capability only */
            streaming?: boolean;
        };
        AiFallbackResponseDto: {
            providerId: string;
            modelId: string;
        };
        AiRoutingResponseDto: {
            providerId: string;
            modelId: string;
            decisionFactors: {
                [key: string]: unknown;
            };
            candidateMetadata?: {
                [key: string]: unknown;
            }[];
            fallbacks: components["schemas"]["AiFallbackResponseDto"][];
        };
        AiErrorResponseDto: {
            statusCode: number;
            code: string;
            message: string;
            requestId: string;
        };
        AiMessageRequestDto: {
            /** @enum {string} */
            role: "system" | "user" | "assistant";
            content: string;
        };
        AiInvocationRequestDto: {
            /** @example completion */
            taskType: string;
            messages: components["schemas"]["AiMessageRequestDto"][];
            /**
             * @default sync
             * @enum {string}
             */
            mode: "sync";
            language?: string;
        };
        AiUsageResponseDto: {
            inputTokens: number;
            outputTokens: number;
            cachedTokens: number;
            totalTokens: number;
        };
        AiCostResponseDto: {
            inputCost: string;
            outputCost: string;
            totalCost: string;
            currency: string;
        };
        AiRoutingSelectionResponseDto: {
            providerId: string;
            modelId: string;
            decisionFactors: {
                [key: string]: unknown;
            };
            candidateMetadata?: {
                [key: string]: unknown;
            }[];
        };
        AiInvocationResponseDto: {
            requestId: string;
            providerId: string;
            modelId: string;
            content: string;
            finishReason?: string;
            usage: components["schemas"]["AiUsageResponseDto"];
            cost: components["schemas"]["AiCostResponseDto"];
            routing: components["schemas"]["AiRoutingSelectionResponseDto"];
        };
        CustomProviderCredentialMetadataDto: {
            id: string;
            name: string;
            /** @enum {string} */
            status: "ACTIVE" | "DISABLED" | "REVOKED";
            priority: number;
            /** Format: date-time */
            lastUsedAt?: string;
        };
        CustomProviderResponseDto: {
            id: string;
            displayName: string;
            /** @enum {string} */
            protocolId: "openai-chat-completions-v1";
            baseUrl: string;
            validationModelId: string;
            supportsStreaming: boolean;
            supportsTools: boolean;
            /** @enum {string} */
            status: "ACTIVE" | "DISABLED" | "ARCHIVED";
            credentialConfigured: boolean;
            credentials: components["schemas"]["CustomProviderCredentialMetadataDto"][];
            /** Format: date-time */
            archivedAt?: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        CreateCustomProviderDto: {
            displayName: string;
            /** @enum {string} */
            protocolId: "openai-chat-completions-v1";
            baseUrl: string;
            validationModelId: string;
            /** @default false */
            supportsStreaming: boolean;
            /** @default false */
            supportsTools: boolean;
        };
        UpdateCustomProviderDto: {
            displayName?: string;
            baseUrl?: string;
            validationModelId?: string;
            supportsStreaming?: boolean;
            supportsTools?: boolean;
        };
        CustomProviderCredentialDto: {
            name?: string;
            secret: string;
        };
        CustomProviderCredentialWriteResponseDto: {
            id: string;
            name: string;
            /** @enum {string} */
            status: "ACTIVE" | "DISABLED" | "REVOKED";
        };
        CustomProviderValidationResponseDto: {
            providerId: string;
            protocolId: string;
            available: boolean;
            /** Format: date-time */
            checkedAt: string;
            latencyMs: number;
            errorCode?: string;
            providerStatus?: number;
        };
        ModelCapabilityEvidenceDto: {
            /** @enum {string} */
            source: "PLATFORM_CURATED" | "PROVIDER_SYNC" | "MODEL_VALIDATION" | "WORKSPACE_DECLARED";
            /** @enum {string} */
            state: "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";
            /** Format: date-time */
            observedAt: string;
        };
        ModelCapabilityResponseDto: {
            /** @enum {string} */
            key: "TEXT_CHAT" | "STREAMING" | "TOOLS" | "STRUCTURED_OUTPUT" | "REASONING" | "VISION_INPUT" | "IMAGE_GENERATION" | "AUDIO_INPUT" | "AUDIO_OUTPUT" | "VIDEO" | "EMBEDDINGS" | "AUDIO" | "FUNCTION_CALLING" | "MCP";
            /** @enum {string} */
            catalogState: "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";
            evidence: components["schemas"]["ModelCapabilityEvidenceDto"][];
        };
        ModelPriceResponseDto: {
            /** @enum {string} */
            state: "KNOWN" | "UNKNOWN";
            inputRate?: string;
            outputRate?: string;
            cachedInputRate?: string;
            currency?: string;
            /** @enum {string} */
            unit?: "PER_MILLION_TOKENS";
            /** @enum {string} */
            source?: "PLATFORM_CURATED" | "PROVIDER_SYNC" | "MODEL_VALIDATION" | "WORKSPACE_DECLARED";
            /** Format: date-time */
            effectiveFrom?: string;
            /** Format: date-time */
            effectiveTo?: string;
            /** Format: date-time */
            observedAt?: string;
        };
        CatalogModelResponseDto: {
            /** Format: uuid */
            id: string;
            providerModelId: string;
            modelName: string;
            displayName: string;
            family?: string;
            version?: string;
            contextWindow?: number;
            maxOutputTokens?: number;
            categories: string[];
            /** @enum {string} */
            source: "BUILT_IN" | "PROVIDER_SYNCED" | "CUSTOM";
            /** @enum {string} */
            status: "ACTIVE" | "DISABLED" | "DEPRECATED" | "ARCHIVED";
            /** Format: uuid */
            ownerWorkspaceId?: string;
            /** Format: uuid */
            providerId?: string;
            /** Format: uuid */
            customProviderId?: string;
            /**
             * @description Catalog boundary only; does not certify configured credentials or production eligibility
             * @enum {string}
             */
            productionIntegration: "LEGACY_BUILT_IN_PATH" | "SPRINT_C_REQUIRED" | "LIFECYCLE_BLOCKED";
            warnings: string[];
            capabilities: components["schemas"]["ModelCapabilityResponseDto"][];
            pricing: components["schemas"]["ModelPriceResponseDto"];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            /** Format: date-time */
            archivedAt?: string;
        };
        CatalogPageResponseDto: {
            items: components["schemas"]["CatalogModelResponseDto"][];
            total: number;
            page: number;
            limit: number;
        };
        ModelCapabilityInputDto: {
            /** @enum {string} */
            key: "TEXT_CHAT" | "STREAMING" | "TOOLS" | "STRUCTURED_OUTPUT" | "REASONING" | "VISION_INPUT" | "IMAGE_GENERATION" | "AUDIO_INPUT" | "AUDIO_OUTPUT" | "VIDEO" | "EMBEDDINGS" | "AUDIO" | "FUNCTION_CALLING";
            /** @enum {string} */
            state: "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";
        };
        ModelPriceInputDto: {
            /** @enum {string} */
            state: "KNOWN" | "UNKNOWN";
            /** @enum {string} */
            source: "WORKSPACE_DECLARED";
            inputRate?: string;
            outputRate?: string;
            cachedInputRate?: string;
            /** @enum {string} */
            currency: "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD" | "CHF" | "CNY" | "INR";
            /** @enum {string} */
            unit: "PER_MILLION_TOKENS";
            /** Format: date-time */
            effectiveFrom: string;
            /** Format: date-time */
            effectiveTo?: string;
        };
        CreateCustomModelDto: {
            displayName: string;
            family?: string;
            version?: string;
            contextWindow?: number;
            maxOutputTokens?: number;
            categories?: ("TEXT" | "CHAT" | "CODE" | "REASONING" | "VISION" | "IMAGE" | "AUDIO" | "VIDEO" | "EMBEDDING")[];
            capabilities?: components["schemas"]["ModelCapabilityInputDto"][];
            pricing?: components["schemas"]["ModelPriceInputDto"];
            /** Format: uuid */
            providerId?: string;
            /** Format: uuid */
            customProviderId?: string;
            providerModelId: string;
        };
        UpdateCustomModelDto: {
            displayName?: string;
            family?: string;
            version?: string;
            contextWindow?: number;
            maxOutputTokens?: number;
            categories?: ("TEXT" | "CHAT" | "CODE" | "REASONING" | "VISION" | "IMAGE" | "AUDIO" | "VIDEO" | "EMBEDDING")[];
            capabilities?: components["schemas"]["ModelCapabilityInputDto"][];
            pricing?: components["schemas"]["ModelPriceInputDto"];
            /** @enum {string} */
            status?: "ACTIVE" | "DISABLED" | "DEPRECATED";
        };
        DashboardRuntimeBootstrapDto: {
            version: string;
            compatibilityVersion: string;
            revision: number;
            generatedAt: string;
            manifestHash: string;
            manifest: {
                [key: string]: unknown;
            };
            navigation: {
                [key: string]: unknown;
            };
            branding?: {
                [key: string]: unknown;
            };
            features: string[];
            permissions: string[];
            layouts: string[];
            widgets: Record<string, never>[];
        };
        CreateStudioProjectDto: {
            name: string;
            slug: string;
            description?: string;
            draft?: {
                [key: string]: unknown;
            };
        };
        UpdateStudioProjectDraftDto: {
            name?: string;
            description?: string;
            draft: {
                [key: string]: unknown;
            };
        };
        PublishStudioProjectDto: {
            changeSummary?: string;
        };
        RollbackStudioProjectDto: {
            changeSummary?: string;
            revision: number;
        };
        PromptNamedDto: {
            name: string;
            slug: string;
        };
        UpdatePromptNamedDto: {
            name?: string;
            slug?: string;
        };
        PromptVariableDto: {
            name: string;
            /** @enum {string} */
            type: "string" | "number" | "boolean" | "json";
            description?: string;
            required?: boolean;
            defaultValue?: Record<string, never> | null;
        };
        CreatePromptDto: {
            name: string;
            slug: string;
            description?: string;
            /** Format: uuid */
            categoryId?: string;
            tagIds?: string[];
            draft?: {
                [key: string]: unknown;
            };
            variables?: components["schemas"]["PromptVariableDto"][];
            metadata?: {
                [key: string]: unknown;
            };
        };
        UpdatePromptDraftDto: {
            name?: string;
            description?: Record<string, never> | null;
            /** Format: uuid */
            categoryId?: Record<string, never> | null;
            tagIds?: string[];
            draft?: {
                [key: string]: unknown;
            };
            variables?: components["schemas"]["PromptVariableDto"][];
            metadata?: {
                [key: string]: unknown;
            };
        };
        UpdatePromptMetadataDto: {
            metadata: {
                [key: string]: unknown;
            };
            variables?: components["schemas"]["PromptVariableDto"][];
        };
        PublishPromptDto: {
            changeSummary?: string;
        };
        RollbackPromptDto: {
            changeSummary?: string;
            revision: number;
        };
        ClonePromptDto: {
            name: string;
            slug: string;
        };
        FavoritePromptDto: {
            favorite: boolean;
        };
        AgentRetryPolicyDto: {
            maxAttempts: number;
            backoffMs: number;
            backoffMultiplier?: number;
        };
        AgentConfigurationDto: {
            /** Format: uuid */
            providerId: string;
            /** Format: uuid */
            modelId: string;
            /** Format: uuid */
            providerConfigurationId?: string;
            providerConfiguration?: {
                [key: string]: unknown;
            };
            modelConfiguration?: {
                [key: string]: unknown;
            };
            runtimeConfiguration?: {
                [key: string]: unknown;
            };
            /** @default 0.7 */
            temperature: number;
            topP?: number;
            maxTokens: number;
            stopSequences?: string[];
            /** @default false */
            streaming: boolean;
            /** @default 30000 */
            timeoutMs: number;
            retryPolicy?: components["schemas"]["AgentRetryPolicyDto"];
            fallbackStrategy?: {
                [key: string]: unknown;
            };
        };
        AgentCapabilitiesDto: {
            knowledgeEnabled?: boolean;
            toolsEnabled?: boolean;
            memoryEnabled?: boolean;
            visionEnabled?: boolean;
            reasoningEnabled?: boolean;
            voiceEnabled?: boolean;
            imageEnabled?: boolean;
            streamingEnabled?: boolean;
            moderationEnabled?: boolean;
            metadata?: {
                [key: string]: unknown;
            };
        };
        AgentPromptVariableDto: {
            name: string;
            type: string;
            description?: string;
            required?: boolean;
            defaultValue?: Record<string, never> | null;
        };
        AgentPromptBindingDto: {
            /** @enum {string} */
            role: "SYSTEM" | "DEVELOPER" | "USER_TEMPLATE" | "LIBRARY";
            /** Format: uuid */
            promptId: string;
            /** Format: uuid */
            promptVersionId?: string;
            variableMetadata?: components["schemas"]["AgentPromptVariableDto"][];
            metadata?: {
                [key: string]: unknown;
            };
        };
        ConversationHistoryConfigDto: {
            /**
             * @description Whether the Agent may use conversation history as working context
             * @default false
             */
            enabled: boolean;
        };
        CreateAgentDto: {
            name: string;
            slug: string;
            description?: string;
            category?: string;
            avatarMetadata?: {
                [key: string]: unknown;
            };
            colorMetadata?: {
                [key: string]: unknown;
            };
            iconMetadata?: {
                [key: string]: unknown;
            };
            /**
             * @default WORKSPACE
             * @enum {string}
             */
            visibility: "PRIVATE" | "WORKSPACE";
            configuration: components["schemas"]["AgentConfigurationDto"];
            capabilities?: components["schemas"]["AgentCapabilitiesDto"];
            promptBindings?: components["schemas"]["AgentPromptBindingDto"][];
            /** @description Whether this Agent may use conversation history as working context. Defaults to OFF for new Agents. */
            conversationHistory?: components["schemas"]["ConversationHistoryConfigDto"];
        };
        UpdateAgentDraftDto: {
            name?: string;
            slug?: string;
            description?: string;
            category?: string;
            avatarMetadata?: {
                [key: string]: unknown;
            };
            colorMetadata?: {
                [key: string]: unknown;
            };
            iconMetadata?: {
                [key: string]: unknown;
            };
            /**
             * @default WORKSPACE
             * @enum {string}
             */
            visibility: "PRIVATE" | "WORKSPACE";
            configuration?: components["schemas"]["AgentConfigurationDto"];
            capabilities?: components["schemas"]["AgentCapabilitiesDto"];
            promptBindings?: components["schemas"]["AgentPromptBindingDto"][];
            /** @description Whether this Agent may use conversation history as working context. Defaults to OFF for new Agents. */
            conversationHistory?: components["schemas"]["ConversationHistoryConfigDto"];
        };
        PersonalityDimensionDto: {
            base: number;
            intensity: number;
        };
        UpdateOperationalPersonalityDto: {
            warmth: components["schemas"]["PersonalityDimensionDto"];
            enthusiasm: components["schemas"]["PersonalityDimensionDto"];
            formality: components["schemas"]["PersonalityDimensionDto"];
        };
        UpdateConversationHistoryDto: {
            /** @description Whether the Agent may use conversation history as working context */
            enabled: boolean;
        };
        UpdateAutomaticExecutionDto: {
            /** @description Whether this Agent may automatically execute on inbound channel messages */
            enabled: boolean;
        };
        PublishAgentDto: {
            changeSummary?: string;
        };
        RollbackAgentDto: {
            changeSummary?: string;
            revision: number;
        };
        CloneAgentDto: {
            name: string;
            slug: string;
        };
        SwitchChannelAgentDto: {
            /** @description Expected ChannelConnection state version for optimistic concurrency */
            expectedStateVersion: number;
        };
        BindRetrievalRuntimeDto: {
            /**
             * Format: uuid
             * @description Id of a published RetrievalRuntime to bind to the agent
             */
            retrievalRuntimeId: string;
        };
        AgentRuntimeContextDto: {
            traceId: string;
            /** @example en-US */
            locale?: string;
            /** @example Africa/Cairo */
            timezone?: string;
            requestMetadata?: {
                [key: string]: unknown;
            };
            executionMetadata?: {
                [key: string]: unknown;
            };
            environmentMetadata?: {
                [key: string]: unknown;
            };
            tenantMetadata?: {
                [key: string]: unknown;
            };
            runtimeMetadata?: {
                [key: string]: unknown;
            };
        };
        RuntimeVariableDto: {
            name: string;
            /** @enum {string} */
            type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "OBJECT" | "ARRAY" | "ANY";
            /** @enum {string} */
            source: "EXECUTION_REQUEST" | "AGENT" | "CONVERSATION" | "WORKSPACE" | "EXECUTION" | "ENVIRONMENT";
            /** @description JSON-compatible runtime value */
            value: Record<string, never>;
        };
        RuntimeConversationContextDto: {
            /** Format: uuid */
            conversationId?: string;
            /** Format: uuid */
            parentExecutionRunId?: string;
            historyReferences?: Record<string, never>[];
            memoryReferences?: Record<string, never>[];
            participantMetadata?: {
                [key: string]: unknown;
            };
            tokenAccountingMetadata?: {
                [key: string]: unknown;
            };
        };
        RuntimePromptContextDto: {
            assistantHistory?: Record<string, never>[];
            metadataBlocks?: Record<string, never>[];
            attachments?: Record<string, never>[];
            templateReferences?: Record<string, never>[];
        };
        PrepareAgentRuntimeDto: {
            /** Format: uuid */
            agentId: string;
            /** Format: uuid */
            agentVersionId?: string;
            /** Format: uuid */
            executionProfileId: string;
            /** Format: uuid */
            executionProfileVersionId?: string;
            /** Format: uuid */
            executionRequestId: string;
            /** Format: uuid */
            executionRunId?: string;
            context: components["schemas"]["AgentRuntimeContextDto"];
            variables?: components["schemas"]["RuntimeVariableDto"][];
            conversation?: components["schemas"]["RuntimeConversationContextDto"];
            prompt?: components["schemas"]["RuntimePromptContextDto"];
        };
        PromptSectionsDto: {
            systemPrompt?: string;
            developerPrompt?: string;
            userPrompt?: string;
        };
        AssistantHistoryDto: {
            content: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        PromptMetadataBlockDto: {
            type: string;
            /** @description JSON-compatible metadata block content */
            content: Record<string, never>;
            metadata?: {
                [key: string]: unknown;
            };
        };
        PromptConditionDto: {
            variable: string;
            /** @enum {string} */
            operator: "EXISTS" | "EQUALS" | "NOT_EQUALS";
            value?: Record<string, never> | null;
            target?: string;
        };
        CompilerVariableDto: {
            name: string;
            /** @enum {string} */
            type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "ARRAY" | "OBJECT" | "NULL";
            /** @enum {string} */
            source: "EXECUTION_RUNTIME" | "AGENT_RUNTIME" | "WORKSPACE" | "CONVERSATION" | "EXECUTION_METADATA" | "ENVIRONMENT" | "STATIC_DEFAULT" | "PROMPT_DEFAULT";
            /** @description JSON-compatible variable value */
            value: Record<string, never> | null;
        };
        CompilePromptDto: {
            /** Format: uuid */
            promptId: string;
            /** Format: uuid */
            promptVersionId: string;
            /** Format: uuid */
            agentVersionId?: string;
            /** Format: uuid */
            agentRuntimeSnapshotId?: string;
            /** Format: uuid */
            executionRequestId?: string;
            /** Format: uuid */
            conversationId?: string;
            sections?: components["schemas"]["PromptSectionsDto"];
            assistantHistory?: components["schemas"]["AssistantHistoryDto"][];
            metadataBlocks?: components["schemas"]["PromptMetadataBlockDto"][];
            conditions?: components["schemas"]["PromptConditionDto"][];
            variables?: components["schemas"]["CompilerVariableDto"][];
            conversationMetadata?: {
                [key: string]: unknown;
            };
            runtimeMetadata?: {
                [key: string]: unknown;
            };
            executionMetadata?: {
                [key: string]: unknown;
            };
            environmentMetadata?: {
                [key: string]: unknown;
            };
            workspaceMetadata?: {
                [key: string]: unknown;
            };
            /** @default 500000 */
            maxPromptSizeBytes: number;
        };
        PromptExecutionVariableDto: {
            name: string;
            /** @enum {string} */
            type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "ARRAY" | "OBJECT" | "NULL";
            value: Record<string, never> | null;
        };
        PromptExecutionMessageDto: {
            /** @enum {string} */
            role: "system" | "user" | "assistant";
            content: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        PromptAssistantHistoryDto: {
            content: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        RenderPromptExecutionDto: {
            /** Format: uuid */
            compiledPromptId: string;
            /** Format: uuid */
            agentRuntimeSnapshotId?: string;
            /** Format: uuid */
            conversationRuntimeSnapshotId?: string;
            /** Format: uuid */
            providerRuntimeSnapshotId?: string;
            /** Format: uuid */
            executionPipelineSnapshotId?: string;
            /** Format: uuid */
            executionRequestId?: string;
            /** Format: uuid */
            executionRunId?: string;
            variables?: components["schemas"]["PromptExecutionVariableDto"][];
            conversationMessages?: components["schemas"]["PromptExecutionMessageDto"][];
            assistantHistory?: components["schemas"]["PromptAssistantHistoryDto"][];
            runtimeMetadata?: {
                [key: string]: unknown;
            };
        };
        PrepareProviderRequestDto: {
            estimatedInputTokens: number;
            maxOutputTokens?: number;
            temperature?: number;
            topP?: number;
            presencePenalty?: number;
            frequencyPenalty?: number;
            stopSequences?: string[];
            structuredOutput?: boolean;
            vision?: boolean;
            image?: boolean;
            tools?: boolean;
            streaming?: boolean;
            reasoning?: boolean;
            /** Format: uuid */
            compiledPromptId: string;
            /** Format: uuid */
            agentRuntimeSnapshotId: string;
            providerVersion?: string;
            modelVersion?: string;
            conversationMetadata?: {
                [key: string]: unknown;
            };
            requestMetadata?: {
                [key: string]: unknown;
            };
            executionPolicies?: {
                [key: string]: unknown;
            };
            safetyMetadata?: {
                [key: string]: unknown;
            };
            traceMetadata?: {
                [key: string]: unknown;
            };
        };
        PipelineNodeDto: {
            nodeKey: string;
            stage: string;
            ordinal: number;
            /** @enum {string} */
            assetType?: "EXECUTION_REQUEST" | "AGENT_RUNTIME" | "COMPILED_PROMPT" | "PROVIDER_RUNTIME" | "RETRIEVAL_RUNTIME" | "CONVERSATION_RUNTIME" | "WORKFLOW" | "EXECUTION_PROFILE";
            /** Format: uuid */
            assetId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        PipelineDependencyDto: {
            dependencyKey: string;
            fromNodeKey: string;
            toNodeKey: string;
            /** @default true */
            required: boolean;
            metadata?: {
                [key: string]: unknown;
            };
        };
        PipelineVariableDto: {
            name: string;
            /** @enum {string} */
            type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "ARRAY" | "OBJECT" | "NULL";
            value: Record<string, never> | null;
            /** @default false */
            required: boolean;
        };
        PipelineMetadataDto: {
            key: string;
            value: Record<string, never> | null;
        };
        PipelineValueDto: {
            value: string;
        };
        CreateExecutionPipelineDto: {
            name: string;
            /** @example 1.0.0 */
            compatibilityVersion: string;
            nodes: components["schemas"]["PipelineNodeDto"][];
            dependencies?: components["schemas"]["PipelineDependencyDto"][];
            variables?: components["schemas"]["PipelineVariableDto"][];
            metadataItems?: components["schemas"]["PipelineMetadataDto"][];
            labels?: components["schemas"]["PipelineValueDto"][];
            tags?: components["schemas"]["PipelineValueDto"][];
            metadata?: {
                [key: string]: unknown;
            };
        };
        UpdateExecutionPipelineDto: {
            name: string;
            /** @example 1.0.0 */
            compatibilityVersion: string;
            nodes: components["schemas"]["PipelineNodeDto"][];
            dependencies?: components["schemas"]["PipelineDependencyDto"][];
            variables?: components["schemas"]["PipelineVariableDto"][];
            metadataItems?: components["schemas"]["PipelineMetadataDto"][];
            labels?: components["schemas"]["PipelineValueDto"][];
            tags?: components["schemas"]["PipelineValueDto"][];
            metadata?: {
                [key: string]: unknown;
            };
        };
        RollbackExecutionPipelineDto: {
            /** Format: uuid */
            revisionId: string;
        };
        CloneExecutionPipelineDto: {
            name?: string;
        };
        CreateExecutionRequestDto: {
            /** @enum {string} */
            sourceType: "PROFILE" | "WORKFLOW" | "AGENT" | "PROMPT" | "KNOWLEDGE" | "TOOL" | "PROVIDER" | "WORKSPACE" | "MANUAL" | "SYSTEM";
            /** Format: uuid */
            sourceReferenceId?: string;
            correlationId: string;
            idempotencyKey: string;
            /** @default 0 */
            priority: number;
            metadata?: {
                [key: string]: unknown;
            };
        };
        CreateExecutionRunDto: {
            /** Format: uuid */
            parentRunId?: string;
            runtimeMetadata?: {
                [key: string]: unknown;
            };
        };
        TransitionExecutionDto: {
            /** @enum {string} */
            status: "REQUESTED" | "QUEUED" | "STARTING" | "RUNNING" | "PAUSED" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
            expectedStateVersion?: number;
            message?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        CancelExecutionDto: {
            expectedStateVersion?: number;
            reason?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        RecordExecutionFailureDto: {
            code: string;
            message: string;
            expectedStateVersion?: number;
            metadata?: {
                [key: string]: unknown;
            };
        };
        RecordExecutionStepDto: {
            sequence: number;
            stepType: string;
            name?: string;
            /** @enum {string} */
            status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "TIMED_OUT" | "SKIPPED";
            inputMetadata?: {
                [key: string]: unknown;
            };
            outputMetadata?: {
                [key: string]: unknown;
            };
            errorMetadata?: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            startedAt?: string;
            /** Format: date-time */
            endedAt?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        AppendExecutionEventDto: {
            eventType: string;
            message?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        AppendExecutionLogDto: {
            /** @enum {string} */
            level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";
            message: string;
            /** Format: uuid */
            stepId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        PrepareAgentExecutionDto: {
            /** Format: uuid */
            agentRuntimeSnapshotId: string;
            /** Format: uuid */
            promptExecutionPayloadId: string;
            /** Format: uuid */
            providerRuntimeSnapshotId: string;
            /** Format: uuid */
            conversationRuntimeSnapshotId?: string;
            /** Format: uuid */
            executionPipelineSnapshotId: string;
            /**
             * Format: uuid
             * @description Parent Execution Kernel run for nested orchestration
             */
            parentExecutionRunId?: string;
            correlationId: string;
            idempotencyKey: string;
            priority?: number;
            metadata?: {
                [key: string]: unknown;
            };
            memoryRuntimeSnapshotIds?: string[];
            memoryCompatibilityVersion?: string;
        };
        CancelAgentExecutionDto: {
            reason?: string;
        };
        AgentConversationMessageDto: {
            /** @enum {string} */
            role: "user" | "assistant";
            content: string;
            /** Format: uuid */
            agentId?: string;
            agentName?: string;
        };
        AgentIdentityDto: {
            /** Format: uuid */
            agentId?: string;
            agentName?: string;
        };
        AgentMemoryWriteDto: {
            /** Format: uuid */
            runtimeId: string;
            content: {
                [key: string]: unknown;
            };
            expectedStateVersion: number;
            metadata?: {
                [key: string]: unknown;
            };
        };
        AgentToolCallDto: {
            /** Format: uuid */
            toolVersionId: string;
            input: {
                [key: string]: unknown;
            };
            timeoutMs?: number;
        };
        ExecuteAgentExecutionDto: {
            /** Format: uuid */
            agentRuntimeSnapshotId: string;
            /** Format: uuid */
            promptExecutionPayloadId: string;
            /** Format: uuid */
            providerRuntimeSnapshotId: string;
            /** Format: uuid */
            conversationRuntimeSnapshotId?: string;
            /** Format: uuid */
            executionPipelineSnapshotId: string;
            /**
             * Format: uuid
             * @description Parent Execution Kernel run for nested orchestration
             */
            parentExecutionRunId?: string;
            correlationId: string;
            idempotencyKey: string;
            priority?: number;
            metadata?: {
                [key: string]: unknown;
            };
            memoryRuntimeSnapshotIds?: string[];
            memoryCompatibilityVersion?: string;
            taskType: string;
            userMessage?: string;
            conversationHistory?: components["schemas"]["AgentConversationMessageDto"][];
            agentIdentity?: components["schemas"]["AgentIdentityDto"];
            language?: string;
            /** Format: uuid */
            retrievalRuntimeSnapshotId?: string;
            /** @enum {string} */
            retrievalMode?: "KEYWORD" | "SEMANTIC" | "HYBRID";
            retrievalTopK?: number;
            retrievalTokenBudget?: number;
            staticVariables?: {
                [key: string]: unknown;
            };
            memoryWrites?: components["schemas"]["AgentMemoryWriteDto"][];
            toolCalls?: components["schemas"]["AgentToolCallDto"][];
            availableToolVersionIds?: string[];
        };
        StreamAgentExecutionDto: {
            /** Format: uuid */
            agentRuntimeSnapshotId: string;
            /** Format: uuid */
            promptExecutionPayloadId: string;
            /** Format: uuid */
            providerRuntimeSnapshotId: string;
            /** Format: uuid */
            conversationRuntimeSnapshotId?: string;
            /** Format: uuid */
            executionPipelineSnapshotId: string;
            /**
             * Format: uuid
             * @description Parent Execution Kernel run for nested orchestration
             */
            parentExecutionRunId?: string;
            correlationId: string;
            idempotencyKey: string;
            priority?: number;
            metadata?: {
                [key: string]: unknown;
            };
            memoryRuntimeSnapshotIds?: string[];
            memoryCompatibilityVersion?: string;
            taskType: string;
            userMessage?: string;
            conversationHistory?: components["schemas"]["AgentConversationMessageDto"][];
            agentIdentity?: components["schemas"]["AgentIdentityDto"];
            language?: string;
            /** Format: uuid */
            retrievalRuntimeSnapshotId?: string;
            /** @enum {string} */
            retrievalMode?: "KEYWORD" | "SEMANTIC" | "HYBRID";
            retrievalTopK?: number;
            retrievalTokenBudget?: number;
            staticVariables?: {
                [key: string]: unknown;
            };
            memoryWrites?: components["schemas"]["AgentMemoryWriteDto"][];
            toolCalls?: components["schemas"]["AgentToolCallDto"][];
            availableToolVersionIds?: string[];
            timeoutMs?: number;
        };
        ConversationContextDto: {
            metadata?: {
                [key: string]: unknown;
            };
            contextKey: string;
            /** Format: uuid */
            agentRuntimeSnapshotId?: string;
            /** Format: uuid */
            retrievalSnapshotId?: string;
            /** Format: uuid */
            compiledPromptId?: string;
            /** Format: uuid */
            providerSnapshotId?: string;
            /** Format: uuid */
            executionRequestId?: string;
            /** Format: uuid */
            executionRunId?: string;
            locale?: string;
            timezone?: string;
            correlationId?: string;
        };
        ConversationVariableDto: {
            metadata?: {
                [key: string]: unknown;
            };
            name: string;
            /** @enum {string} */
            type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "ARRAY" | "OBJECT" | "NULL";
            value: Record<string, never> | null;
        };
        ConversationParticipantDto: {
            metadata?: {
                [key: string]: unknown;
            };
            participantKey: string;
            /** @enum {string} */
            type: "CUSTOMER" | "USER" | "AGENT" | "SYSTEM" | "EXTERNAL";
            /** Format: uuid */
            referenceId?: string;
            displayMetadata?: {
                [key: string]: unknown;
            };
        };
        ConversationMessageDto: {
            metadata?: {
                [key: string]: unknown;
            };
            messageIdentifier: string;
            ordinal: number;
            /** @enum {string} */
            role: "SYSTEM" | "DEVELOPER" | "USER" | "ASSISTANT" | "TOOL";
            participantKey?: string;
            contentHash?: string;
            tokenMetadata?: {
                [key: string]: unknown;
            };
        };
        ConversationAttachmentDto: {
            metadata?: {
                [key: string]: unknown;
            };
            attachmentIdentifier: string;
            messageIdentifier?: string;
            /** @enum {string} */
            type: "FILE" | "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
            mimeType: string;
            fileName?: string;
            sizeBytes?: number;
            checksum?: string;
        };
        ConversationValueDto: {
            metadata?: {
                [key: string]: unknown;
            };
            value: string;
        };
        ConversationNoteDto: {
            metadata?: {
                [key: string]: unknown;
            };
            noteKey: string;
        };
        ConversationSettingsDto: {
            /** @default false */
            memoryEnabled: boolean;
            /** @default false */
            moderationEnabled: boolean;
            maxHistoryMessages?: number;
            metadata?: {
                [key: string]: unknown;
            };
        };
        PrepareConversationRuntimeDto: {
            name: string;
            /** Format: uuid */
            sourceConversationId?: string;
            /** @example 1.0.0 */
            compatibilityVersion: string;
            /**
             * @default READY
             * @enum {string}
             */
            initialState: "INITIALIZED" | "READY" | "ACTIVE" | "PAUSED" | "CLOSED";
            contexts?: components["schemas"]["ConversationContextDto"][];
            variables?: components["schemas"]["ConversationVariableDto"][];
            participants?: components["schemas"]["ConversationParticipantDto"][];
            messages?: components["schemas"]["ConversationMessageDto"][];
            attachments?: components["schemas"]["ConversationAttachmentDto"][];
            labels?: components["schemas"]["ConversationValueDto"][];
            tags?: components["schemas"]["ConversationValueDto"][];
            notes?: components["schemas"]["ConversationNoteDto"][];
            settings?: components["schemas"]["ConversationSettingsDto"];
            stateMetadata?: {
                [key: string]: unknown;
            };
            auditMetadata?: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
        };
        TransitionConversationStateDto: {
            /** @enum {string} */
            state: "INITIALIZED" | "READY" | "ACTIVE" | "PAUSED" | "CLOSED";
            metadata?: {
                [key: string]: unknown;
            };
        };
        RollbackConversationRuntimeDto: {
            /** Format: uuid */
            versionId: string;
        };
        CloneConversationRuntimeDto: {
            name?: string;
        };
        CacheCompiledPromptDto: {
            /** Format: uuid */
            compiledPromptId: string;
        };
        CacheRenderedPromptDto: {
            /** Format: uuid */
            compiledPromptId: string;
            staticVariables: {
                [key: string]: unknown;
            };
        };
        CreateRuntimeContextSnapshotDto: {
            /** Format: uuid */
            agentRuntimeSnapshotId?: string;
            /** Format: uuid */
            compiledPromptId?: string;
            /** Format: uuid */
            providerRuntimeSnapshotId?: string;
            /** Format: uuid */
            conversationRuntimeSnapshotId?: string;
            /** Format: uuid */
            retrievalRuntimeSnapshotId?: string;
            /** Format: uuid */
            executionPipelineSnapshotId?: string;
            /** Format: uuid */
            executionProfileVersionId?: string;
            immutableMetadata?: {
                [key: string]: unknown;
            };
        };
        CacheRetrievalRuntimeDto: {
            /** Format: uuid */
            retrievalRuntimeSnapshotId: string;
            languages?: string[];
            searchConfiguration?: {
                [key: string]: unknown;
            };
        };
        CacheImmutablePackageDto: {
            /** @enum {string} */
            type: "COMPILED_PROMPT" | "RENDERED_PROMPT" | "PROVIDER_PROMPT" | "CONVERSATION_PREFIX" | "STUDIO_CONFIGURATION" | "RUNTIME_CONTEXT" | "RETRIEVAL_RUNTIME" | "MEMORY_RUNTIME" | "TOOL_DEFINITION" | "WORKFLOW_PACKAGE" | "EXECUTION_PLAN";
            scopeKey: string;
            sourceHash: string;
            payload: {
                [key: string]: unknown;
            };
            references?: {
                [key: string]: string;
            };
            revision?: number;
            savedTokens?: number;
            compileTimeMs?: number;
        };
        InvalidateOptimizationPackageDto: {
            reason: string;
        };
        MemoryReferenceDto: {
            referenceKey: string;
            /** Format: uuid */
            targetRuntimeId: string;
            targetRevision?: number;
            /** @enum {string} */
            kind: "DEPENDENCY" | "REFERENCE";
            required?: boolean;
            metadata?: {
                [key: string]: unknown;
            };
        };
        CreateMemoryRuntimeDto: {
            identifier: string;
            name: string;
            /** @enum {string} */
            type: "CONVERSATION" | "SESSION" | "WORKSPACE" | "AGENT" | "EXECUTION" | "TEMPORARY_RUNTIME" | "SHARED_RUNTIME" | "REFERENCE";
            scopeKey: string;
            content: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
            compatibilityVersion: string;
            /** Format: uuid */
            executionRequestId?: string;
            /** Format: uuid */
            executionRunId?: string;
            references?: components["schemas"]["MemoryReferenceDto"][];
        };
        UpdateMemoryRuntimeDto: {
            content: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
            expectedStateVersion: number;
            references?: components["schemas"]["MemoryReferenceDto"][];
        };
        RollbackMemoryRuntimeDto: {
            /** Format: uuid */
            versionId: string;
            expectedStateVersion: number;
        };
        ResolveMemoryRuntimeDto: {
            snapshotIds: string[];
            compatibilityVersion: string;
            /** Format: uuid */
            executionRequestId?: string;
            /** Format: uuid */
            executionRunId?: string;
        };
        CommitMemoryWritesDto: {
            /** Format: uuid */
            runtimeId: string;
            content: {
                [key: string]: unknown;
            };
            expectedStateVersion: number;
            /** Format: uuid */
            executionRunId: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        RetrievalExecutionFilterDto: {
            key: string;
            /** @enum {string} */
            operator: "EQUALS" | "NOT_EQUALS" | "IN" | "NOT_IN" | "EXISTS";
            value: Record<string, never>;
        };
        ExecuteRetrievalDto: {
            /** Format: uuid */
            retrievalRuntimeSnapshotId: string;
            query: string;
            /**
             * @default HYBRID
             * @enum {string}
             */
            mode: "KEYWORD" | "SEMANTIC" | "HYBRID";
            /** @default 10 */
            topK: number;
            /** @default 0 */
            minScore: number;
            /** @default 4000 */
            maxTokens: number;
            /** @default 1.0 */
            compatibilityVersion: string;
            /** Format: uuid */
            executionRequestId?: string;
            /** Format: uuid */
            executionRunId?: string;
            filters?: components["schemas"]["RetrievalExecutionFilterDto"][];
            providerCapabilities?: string[];
            metadata?: {
                [key: string]: unknown;
            };
        };
        ToolRetrievalRequestDto: {
            /** Format: uuid */
            retrievalRuntimeSnapshotId: string;
            query: string;
            topK?: number;
            tokenBudget?: number;
        };
        ToolMemoryWriteDto: {
            /** Format: uuid */
            runtimeId: string;
            content: {
                [key: string]: unknown;
            };
            expectedStateVersion: number;
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecuteToolDto: {
            /** Format: uuid */
            toolVersionId: string;
            input: {
                [key: string]: unknown;
            };
            /**
             * @default SYNC
             * @enum {string}
             */
            mode: "SYNC" | "STREAM";
            correlationId: string;
            idempotencyKey: string;
            traceId?: string;
            /** Format: uuid */
            parentExecutionId?: string;
            /** Format: uuid */
            parentExecutionRunId?: string;
            timeoutMs?: number;
            retrieval?: components["schemas"]["ToolRetrievalRequestDto"];
            memoryWrites?: components["schemas"]["ToolMemoryWriteDto"][];
            promptVariables?: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
        };
        CancelToolExecutionDto: {
            reason?: string;
        };
        ToolTaxonomyDto: {
            name: string;
            slug: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        UpdateToolTaxonomyDto: {
            name?: string;
            slug?: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        CreateToolGroupDto: {
            name: string;
            slug: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            categoryId?: string;
        };
        UpdateToolGroupDto: {
            name?: string;
            slug?: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            categoryId?: string;
        };
        ToolDefinitionMetadataDto: {
            provider?: {
                [key: string]: unknown;
            };
            authentication?: {
                [key: string]: unknown;
            };
            rateLimit?: {
                [key: string]: unknown;
            };
            executionPolicy?: {
                [key: string]: unknown;
            };
            timeout?: {
                [key: string]: unknown;
            };
            retryPolicy?: {
                [key: string]: unknown;
            };
            cost?: {
                [key: string]: unknown;
            };
            compatibility?: {
                [key: string]: unknown;
            };
            health?: {
                [key: string]: unknown;
            };
            mcp?: {
                [key: string]: unknown;
            };
            custom?: {
                [key: string]: unknown;
            };
        };
        ToolParameterDto: {
            name: string;
            /** @enum {string} */
            location: "PATH" | "QUERY" | "HEADER" | "BODY" | "COOKIE";
            required?: boolean;
            schema: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        ToolSchemaDto: {
            /** @enum {string} */
            kind: "INPUT" | "OUTPUT";
            schema: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
        };
        ToolCapabilityDto: {
            code: string;
            /** @default true */
            enabled: boolean;
            metadata?: {
                [key: string]: unknown;
            };
        };
        ToolPermissionDto: {
            permissionCode: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        CreateToolDefinitionDto: {
            name: string;
            slug: string;
            description?: string;
            /** Format: uuid */
            categoryId?: string;
            /** Format: uuid */
            groupId?: string;
            /** @enum {string} */
            type: "INTERNAL" | "HTTP" | "REST" | "WEBHOOK" | "DATABASE" | "FILE" | "STORAGE" | "WORKFLOW" | "AGENT" | "COMPOSITE" | "OPENAPI" | "INTERNAL_SERVICE" | "FUNCTION" | "MCP";
            /**
             * @default WORKSPACE
             * @enum {string}
             */
            visibility: "PRIVATE" | "WORKSPACE";
            /**
             * @default NONE
             * @enum {string}
             */
            authenticationType: "NONE" | "API_KEY" | "OAUTH2" | "BASIC" | "BEARER" | "CUSTOM";
            metadata?: components["schemas"]["ToolDefinitionMetadataDto"];
            parameters?: components["schemas"]["ToolParameterDto"][];
            schemas?: components["schemas"]["ToolSchemaDto"][];
            capabilities?: components["schemas"]["ToolCapabilityDto"][];
            permissions?: components["schemas"]["ToolPermissionDto"][];
        };
        UpdateToolDefinitionDto: {
            name?: string;
            slug?: string;
            description?: string;
            /** Format: uuid */
            categoryId?: string;
            /** Format: uuid */
            groupId?: string;
            /** @enum {string} */
            type?: "INTERNAL" | "HTTP" | "REST" | "WEBHOOK" | "DATABASE" | "FILE" | "STORAGE" | "WORKFLOW" | "AGENT" | "COMPOSITE" | "OPENAPI" | "INTERNAL_SERVICE" | "FUNCTION" | "MCP";
            /**
             * @default WORKSPACE
             * @enum {string}
             */
            visibility: "PRIVATE" | "WORKSPACE";
            /**
             * @default NONE
             * @enum {string}
             */
            authenticationType: "NONE" | "API_KEY" | "OAUTH2" | "BASIC" | "BEARER" | "CUSTOM";
            metadata?: components["schemas"]["ToolDefinitionMetadataDto"];
            parameters?: components["schemas"]["ToolParameterDto"][];
            schemas?: components["schemas"]["ToolSchemaDto"][];
            capabilities?: components["schemas"]["ToolCapabilityDto"][];
            permissions?: components["schemas"]["ToolPermissionDto"][];
        };
        PublishToolDefinitionDto: {
            changeSummary?: string;
        };
        RollbackToolDefinitionDto: {
            changeSummary?: string;
            revision: number;
        };
        CloneToolDefinitionDto: {
            name: string;
            slug: string;
        };
        ExecuteWorkflowDto: {
            /** Format: uuid */
            workflowVersionId: string;
            correlationId: string;
            idempotencyKey: string;
            traceId?: string;
            input?: {
                [key: string]: unknown;
            };
            /** @default 300000 */
            timeoutMs: number;
            /** @default 10 */
            maxDepth: number;
            /** @default 1000 */
            maxNodeExecutions: number;
            metadata?: {
                [key: string]: unknown;
            };
            /**
             * Format: uuid
             * @description Parent tool/workflow execution identifier
             */
            parentExecutionId?: string;
            /**
             * Format: uuid
             * @description Parent Execution Kernel run identifier
             */
            parentExecutionRunId?: string;
        };
        CancelWorkflowExecutionDto: {
            reason?: string;
        };
        ResolveApprovalDto: {
            approved: boolean;
            reason?: string;
            output?: {
                [key: string]: unknown;
            };
        };
        RetrievalSourceDto: {
            /** Format: uuid */
            documentId: string;
            /** Format: uuid */
            versionId: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        RetrievalCollectionDto: {
            /** Format: uuid */
            collectionId: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        RetrievalFilterDto: {
            key: string;
            /** @enum {string} */
            operator: "EQUALS" | "NOT_EQUALS" | "IN" | "NOT_IN" | "EXISTS";
            value: Record<string, never> | null;
            metadata?: {
                [key: string]: unknown;
            };
        };
        RetrievalVariableDto: {
            name: string;
            /** @enum {string} */
            type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "ARRAY" | "OBJECT" | "NULL";
            value: Record<string, never> | null;
            metadata?: {
                [key: string]: unknown;
            };
        };
        PrepareRetrievalRuntimeDto: {
            name: string;
            /** Format: uuid */
            knowledgeBaseId: string;
            language?: string;
            allowedMimeTypes?: string[];
            sources?: components["schemas"]["RetrievalSourceDto"][];
            collections?: components["schemas"]["RetrievalCollectionDto"][];
            folderIds?: string[];
            categoryIds?: string[];
            tagIds?: string[];
            filters?: components["schemas"]["RetrievalFilterDto"][];
            variables?: components["schemas"]["RetrievalVariableDto"][];
            metadata?: {
                [key: string]: unknown;
            };
        };
        CreateKnowledgeSpaceDto: {
            name: string;
            slug: string;
            metadata?: {
                [key: string]: unknown;
            };
            description?: string;
            /** Format: uuid */
            categoryId?: string;
        };
        UpdateKnowledgeSpaceDto: {
            name?: string;
            slug?: string;
            metadata?: {
                [key: string]: unknown;
            };
            description?: string;
            /** Format: uuid */
            categoryId?: string;
        };
        CreateKnowledgeCollectionDto: {
            name: string;
            slug: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            spaceId: string;
            description?: string;
        };
        UpdateKnowledgeCollectionDto: {
            name?: string;
            slug?: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            spaceId?: string;
            description?: string;
        };
        CreateKnowledgeFolderDto: {
            name: string;
            slug: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            spaceId: string;
            /** Format: uuid */
            collectionId?: string;
            /** Format: uuid */
            parentId?: string;
        };
        UpdateKnowledgeFolderDto: {
            name?: string;
            slug?: string;
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            spaceId?: string;
            /** Format: uuid */
            collectionId?: string;
            /** Format: uuid */
            parentId?: string;
        };
        KnowledgeNamedDto: {
            name: string;
            slug: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        UpdateKnowledgeNamedDto: {
            name?: string;
            slug?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        KnowledgeChunkMetadataDto: {
            ordinal: number;
            checksum?: string;
            tokenCount?: number;
            characterCount?: number;
            strategyMetadata?: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
        };
        CreateKnowledgeDocumentDto: {
            /** Format: uuid */
            spaceId: string;
            /** Format: uuid */
            collectionId?: string;
            /** Format: uuid */
            folderId?: string;
            /** Format: uuid */
            categoryId?: string;
            name: string;
            slug: string;
            description?: string;
            /** @enum {string} */
            sourceType: "FILE" | "URL" | "TEXT" | "IMPORT" | "API";
            sourceUrl?: string;
            fileName?: string;
            originalName?: string;
            /** @default application/octet-stream */
            mimeType: string;
            sizeBytes?: number;
            language?: string;
            checksum?: string;
            tagIds?: string[];
            chunks?: components["schemas"]["KnowledgeChunkMetadataDto"][];
            sourceMetadata?: {
                [key: string]: unknown;
            };
            fileMetadata?: {
                [key: string]: unknown;
            };
            urlMetadata?: {
                [key: string]: unknown;
            };
            parserMetadata?: {
                [key: string]: unknown;
            };
            chunkStrategy?: {
                [key: string]: unknown;
            };
            embeddingStatusMetadata?: {
                [key: string]: unknown;
            };
            syncMetadata?: {
                [key: string]: unknown;
            };
            importMetadata?: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
        };
        UploadKnowledgeDocumentDto: {
            /** Format: uuid */
            spaceId: string;
            /** Format: uuid */
            collectionId?: string;
            /** Format: uuid */
            folderId?: string;
            /** Format: uuid */
            categoryId?: string;
            name?: string;
            slug?: string;
            description?: string;
            language?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        CreateKnowledgeTextDocumentDto: {
            /** Format: uuid */
            spaceId: string;
            /** Format: uuid */
            collectionId?: string;
            /** Format: uuid */
            folderId?: string;
            /** Format: uuid */
            categoryId?: string;
            name: string;
            slug: string;
            /** @description Raw document text to index */
            content: string;
            description?: string;
            language?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        UpdateKnowledgeDocumentDto: {
            /** Format: uuid */
            spaceId?: string;
            /** Format: uuid */
            collectionId?: string;
            /** Format: uuid */
            folderId?: string;
            /** Format: uuid */
            categoryId?: string;
            name?: string;
            slug?: string;
            description?: string;
            /** @enum {string} */
            sourceType?: "FILE" | "URL" | "TEXT" | "IMPORT" | "API";
            sourceUrl?: string;
            fileName?: string;
            originalName?: string;
            /** @default application/octet-stream */
            mimeType: string;
            sizeBytes?: number;
            language?: string;
            checksum?: string;
            tagIds?: string[];
            chunks?: components["schemas"]["KnowledgeChunkMetadataDto"][];
            sourceMetadata?: {
                [key: string]: unknown;
            };
            fileMetadata?: {
                [key: string]: unknown;
            };
            urlMetadata?: {
                [key: string]: unknown;
            };
            parserMetadata?: {
                [key: string]: unknown;
            };
            chunkStrategy?: {
                [key: string]: unknown;
            };
            embeddingStatusMetadata?: {
                [key: string]: unknown;
            };
            syncMetadata?: {
                [key: string]: unknown;
            };
            importMetadata?: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
        };
        PublishKnowledgeDocumentDto: {
            changeSummary?: string;
        };
        RollbackKnowledgeDocumentDto: {
            changeSummary?: string;
            revision: number;
        };
        CloneKnowledgeDocumentDto: {
            name: string;
            slug: string;
        };
        WorkflowTaxonomyDto: {
            name: string;
            slug: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        UpdateWorkflowTaxonomyDto: {
            name?: string;
            slug?: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        WorkflowVariableDto: {
            name: string;
            schema: {
                [key: string]: unknown;
            };
            required?: boolean;
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
            /** @description JSON-compatible default value */
            defaultValue?: Record<string, never>;
        };
        WorkflowNamedSchemaDto: {
            name: string;
            schema: {
                [key: string]: unknown;
            };
            required?: boolean;
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        WorkflowNodeDto: {
            id: string;
            /** @enum {string} */
            type: "START" | "END" | "AGENT" | "PROMPT" | "KNOWLEDGE" | "TOOL" | "WEBHOOK" | "REST" | "CONDITION" | "DELAY" | "LOOP" | "MANUAL" | "DECISION" | "TRANSFORM" | "VARIABLE" | "SUBFLOW" | "SUBWORKFLOW" | "PARALLEL" | "MERGE" | "APPROVAL" | "CUSTOM";
            name?: string;
            /**
             * Format: uuid
             * @description Workspace-scoped Agent, Prompt, Knowledge, Tool, or Subflow reference
             */
            referenceId?: string;
            configuration?: {
                [key: string]: unknown;
            };
            position?: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        WorkflowEdgeDto: {
            id: string;
            sourceNodeId: string;
            targetNodeId: string;
            label?: string;
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        WorkflowConditionDto: {
            key: string;
            nodeId?: string;
            edgeId?: string;
            expression: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        WorkflowBranchDto: {
            nodeId: string;
            key: string;
            label?: string;
            condition: {
                [key: string]: unknown;
            };
            targetNodeId: string;
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        WorkflowLabelDto: {
            name: string;
            /** @example #3366FF */
            color?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        WorkflowNoteDto: {
            content: string;
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        WorkflowPermissionDto: {
            permissionCode: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        CreateWorkflowDto: {
            name: string;
            slug: string;
            description?: string;
            /** Format: uuid */
            categoryId?: string;
            /**
             * @default WORKSPACE
             * @enum {string}
             */
            visibility: "PRIVATE" | "WORKSPACE";
            /** @default MANUAL */
            triggerType: string;
            metadata?: {
                [key: string]: unknown;
            };
            variables?: components["schemas"]["WorkflowVariableDto"][];
            parameters?: components["schemas"]["WorkflowNamedSchemaDto"][];
            inputs?: components["schemas"]["WorkflowNamedSchemaDto"][];
            outputs?: components["schemas"]["WorkflowNamedSchemaDto"][];
            nodes?: components["schemas"]["WorkflowNodeDto"][];
            edges?: components["schemas"]["WorkflowEdgeDto"][];
            conditions?: components["schemas"]["WorkflowConditionDto"][];
            branches?: components["schemas"]["WorkflowBranchDto"][];
            labels?: components["schemas"]["WorkflowLabelDto"][];
            tagIds?: string[];
            notes?: components["schemas"]["WorkflowNoteDto"][];
            permissions?: components["schemas"]["WorkflowPermissionDto"][];
        };
        UpdateWorkflowDto: {
            name?: string;
            slug?: string;
            description?: string;
            /** Format: uuid */
            categoryId?: string;
            /**
             * @default WORKSPACE
             * @enum {string}
             */
            visibility: "PRIVATE" | "WORKSPACE";
            /** @default MANUAL */
            triggerType: string;
            metadata?: {
                [key: string]: unknown;
            };
            variables?: components["schemas"]["WorkflowVariableDto"][];
            parameters?: components["schemas"]["WorkflowNamedSchemaDto"][];
            inputs?: components["schemas"]["WorkflowNamedSchemaDto"][];
            outputs?: components["schemas"]["WorkflowNamedSchemaDto"][];
            nodes?: components["schemas"]["WorkflowNodeDto"][];
            edges?: components["schemas"]["WorkflowEdgeDto"][];
            conditions?: components["schemas"]["WorkflowConditionDto"][];
            branches?: components["schemas"]["WorkflowBranchDto"][];
            labels?: components["schemas"]["WorkflowLabelDto"][];
            tagIds?: string[];
            notes?: components["schemas"]["WorkflowNoteDto"][];
            permissions?: components["schemas"]["WorkflowPermissionDto"][];
        };
        PublishWorkflowDto: {
            changeSummary?: string;
        };
        RollbackWorkflowDto: {
            changeSummary?: string;
            revision: number;
        };
        CloneWorkflowDto: {
            name: string;
            slug: string;
        };
        OrchestrationTaxonomyDto: {
            name: string;
            slug: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        UpdateOrchestrationTaxonomyDto: {
            name?: string;
            slug?: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecutionPriorityLevelDto: {
            name: string;
            slug: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
            value: number;
        };
        UpdateExecutionPriorityLevelDto: {
            name?: string;
            slug?: string;
            description?: string;
            metadata?: {
                [key: string]: unknown;
            };
            value?: number;
        };
        ExecutionPolicyDto: {
            config: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecutionLimitDto: {
            maxSteps?: number;
            maxTokens?: number;
            maxCostMinor?: number;
            maxPayloadBytes?: number;
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecutionTimeoutDto: {
            totalMs: number;
            stepMs?: number;
            idleMs?: number;
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecutionRetryPolicyDto: {
            maxAttempts: number;
            initialDelayMs: number;
            maxDelayMs: number;
            multiplier: number;
            jitter?: boolean;
            retryOn?: string[];
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecutionStrategyPolicyDto: {
            strategy: string;
            config?: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecutionFallbackPolicyDto: {
            strategy: string;
            config?: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
            /** @enum {string} */
            targetType?: "WORKFLOW" | "AGENT" | "PROMPT" | "KNOWLEDGE" | "TOOL" | "PROVIDER" | "WORKSPACE";
            /** Format: uuid */
            targetReferenceId?: string;
        };
        ExecutionConcurrencyPolicyDto: {
            maxParallel: number;
            maxQueued: number;
            strategy: string;
            keyTemplate?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecutionContextDto: {
            name: string;
            schema: {
                [key: string]: unknown;
            };
            /** @description JSON-compatible static context value */
            value?: Record<string, never>;
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        ExecutionVariableDto: {
            name: string;
            schema: {
                [key: string]: unknown;
            };
            required?: boolean;
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
            /** @description JSON-compatible default value */
            defaultValue?: Record<string, never>;
        };
        ExecutionNamedSchemaDto: {
            name: string;
            schema: {
                [key: string]: unknown;
            };
            required?: boolean;
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        ExecutionBindingDto: {
            key: string;
            /** @enum {string} */
            targetType: "WORKFLOW" | "AGENT" | "PROMPT" | "KNOWLEDGE" | "TOOL" | "PROVIDER" | "WORKSPACE";
            /** Format: uuid */
            referenceId: string;
            /** @default true */
            required: boolean;
            config?: {
                [key: string]: unknown;
            };
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        ExecutionDependencyDto: {
            bindingKey: string;
            dependsOnBindingKey: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecutionLabelDto: {
            name: string;
            color?: string;
            metadata?: {
                [key: string]: unknown;
            };
        };
        ExecutionNoteDto: {
            content: string;
            metadata?: {
                [key: string]: unknown;
            };
            sortOrder?: number;
        };
        CreateExecutionProfileDto: {
            name: string;
            slug: string;
            description?: string;
            /** @enum {string} */
            visibility?: "PRIVATE" | "WORKSPACE";
            /** Format: uuid */
            queueDefinitionId?: string;
            /** Format: uuid */
            priorityLevelId?: string;
            metadata?: {
                [key: string]: unknown;
            };
            policy?: components["schemas"]["ExecutionPolicyDto"];
            limits?: components["schemas"]["ExecutionLimitDto"];
            timeouts?: components["schemas"]["ExecutionTimeoutDto"];
            retryPolicy?: components["schemas"]["ExecutionRetryPolicyDto"];
            failurePolicy?: components["schemas"]["ExecutionStrategyPolicyDto"];
            fallbackPolicy?: components["schemas"]["ExecutionFallbackPolicyDto"];
            concurrencyPolicy?: components["schemas"]["ExecutionConcurrencyPolicyDto"];
            contexts?: components["schemas"]["ExecutionContextDto"][];
            variables?: components["schemas"]["ExecutionVariableDto"][];
            inputs?: components["schemas"]["ExecutionNamedSchemaDto"][];
            outputs?: components["schemas"]["ExecutionNamedSchemaDto"][];
            bindings?: components["schemas"]["ExecutionBindingDto"][];
            dependencies?: components["schemas"]["ExecutionDependencyDto"][];
            labels?: components["schemas"]["ExecutionLabelDto"][];
            tagIds?: string[];
            notes?: components["schemas"]["ExecutionNoteDto"][];
        };
        UpdateExecutionProfileDto: {
            name?: string;
            slug?: string;
            description?: string;
            /** @enum {string} */
            visibility?: "PRIVATE" | "WORKSPACE";
            /** Format: uuid */
            queueDefinitionId?: string;
            /** Format: uuid */
            priorityLevelId?: string;
            metadata?: {
                [key: string]: unknown;
            };
            policy?: components["schemas"]["ExecutionPolicyDto"];
            limits?: components["schemas"]["ExecutionLimitDto"];
            timeouts?: components["schemas"]["ExecutionTimeoutDto"];
            retryPolicy?: components["schemas"]["ExecutionRetryPolicyDto"];
            failurePolicy?: components["schemas"]["ExecutionStrategyPolicyDto"];
            fallbackPolicy?: components["schemas"]["ExecutionFallbackPolicyDto"];
            concurrencyPolicy?: components["schemas"]["ExecutionConcurrencyPolicyDto"];
            contexts?: components["schemas"]["ExecutionContextDto"][];
            variables?: components["schemas"]["ExecutionVariableDto"][];
            inputs?: components["schemas"]["ExecutionNamedSchemaDto"][];
            outputs?: components["schemas"]["ExecutionNamedSchemaDto"][];
            bindings?: components["schemas"]["ExecutionBindingDto"][];
            dependencies?: components["schemas"]["ExecutionDependencyDto"][];
            labels?: components["schemas"]["ExecutionLabelDto"][];
            tagIds?: string[];
            notes?: components["schemas"]["ExecutionNoteDto"][];
        };
        PublishExecutionProfileDto: {
            changeSummary?: string;
        };
        RollbackExecutionProfileDto: {
            changeSummary?: string;
            revision: number;
        };
        CloneExecutionProfileDto: {
            name: string;
            slug: string;
        };
        CreateChannelDto: {
            name: string;
            /** @default whatsapp */
            providerKey: string;
            /** @default 1.0 */
            compatibilityVersion: string;
        };
        ChannelCredentialInputDto: {
            name: string;
            secret: string;
        };
        CreateProviderConnectionDto: {
            configuration: {
                [key: string]: unknown;
            };
            credentials: components["schemas"]["ChannelCredentialInputDto"][];
            displayAddress?: string;
        };
        CreateChannelConnectionDto: {
            businessAccountId: string;
            phoneNumberId: string;
            /** @example +15551234567 */
            displayPhoneNumber?: string;
            /** @example v23.0 */
            apiVersion: string;
            accessToken: string;
            verifyToken: string;
            appSecret: string;
        };
        UpdateChannelConnectionDto: {
            businessAccountId?: string;
            phoneNumberId?: string;
            /** @example +15551234567 */
            displayPhoneNumber?: string;
            /** @example v23.0 */
            apiVersion?: string;
            accessToken?: string;
            verifyToken?: string;
            appSecret?: string;
            expectedStateVersion: number;
        };
        UpdateChannelConfigurationDto: {
            configuration: {
                [key: string]: unknown;
            };
            expectedStateVersion: number;
        };
        TransitionChannelConnectionDto: {
            /** @enum {string} */
            state: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "DEGRADED" | "FAILED";
            expectedStateVersion: number;
        };
        RotateChannelCredentialDto: {
            name: string;
            secret: string;
            expectedVersion: number;
            /** Format: date-time */
            expiresAt?: string;
        };
        CreateChannelBatchDto: {
            batchKey: string;
            messageIds: string[];
            /** Format: date-time */
            scheduledAt: string;
        };
        AgentProducerDto: {
            /** Format: uuid */
            agentId: string;
            agentName?: string;
        };
        SendChannelMessageDto: {
            /** Format: uuid */
            connectionId: string;
            recipient: string;
            /** @enum {string} */
            type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "VOICE" | "DOCUMENT" | "STICKER" | "LOCATION" | "CONTACT" | "REACTION" | "REPLY" | "FORWARD" | "QUOTE" | "BUTTON" | "INTERACTIVE" | "LIST" | "TEMPLATE" | "REFERRAL" | "UNKNOWN";
            text?: string;
            content?: {
                [key: string]: unknown;
            };
            attachmentIds?: string[];
            /** Format: uuid */
            replyToMessageId?: string;
            idempotencyKey: string;
            producer?: components["schemas"]["AgentProducerDto"];
        };
        TransitionChannelMessageDto: {
            /** @enum {string} */
            state: "UNKNOWN" | "QUEUED" | "PREPARING" | "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "EXPIRED" | "CANCELLED" | "DELETED" | "RETRIED";
            expectedStateVersion: number;
            reason?: string;
        };
        UploadChannelAttachmentDto: {
            /** Format: uuid */
            channelId: string;
            fileName?: string;
            mimeType: string;
            sizeBytes: number;
            dataBase64: string;
        };
        SetConversationExecutionDto: {
            enabled: boolean;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    HealthController_check_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /**
             * @description Service health status
             *
             *     The Health Check is successful
             */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example ok */
                        status?: string;
                        /**
                         * @example {
                         *       "database": {
                         *         "status": "up"
                         *       }
                         *     }
                         */
                        info?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        } | null;
                        /** @example {} */
                        error?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        } | null;
                        /**
                         * @example {
                         *       "database": {
                         *         "status": "up"
                         *       }
                         *     }
                         */
                        details?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
            };
            /**
             * @description A required dependency is unavailable
             *
             *     The Health Check is not successful
             */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example error */
                        status?: string;
                        /**
                         * @example {
                         *       "database": {
                         *         "status": "up"
                         *       }
                         *     }
                         */
                        info?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        } | null;
                        /**
                         * @example {
                         *       "redis": {
                         *         "status": "down",
                         *         "message": "Could not connect"
                         *       }
                         *     }
                         */
                        error?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        } | null;
                        /**
                         * @example {
                         *       "database": {
                         *         "status": "up"
                         *       },
                         *       "redis": {
                         *         "status": "down",
                         *         "message": "Could not connect"
                         *       }
                         *     }
                         */
                        details?: {
                            [key: string]: {
                                status: string;
                            } & {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
            };
        };
    };
    AuthController_login_v1: {
        parameters: {
            query?: never;
            header: {
                "user-agent": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSuccessResponseDto"] | components["schemas"]["WorkspaceSelectionRequiredResponseDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthErrorResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthErrorResponseDto"];
                };
            };
        };
    };
    AuthController_selectWorkspace_v1: {
        parameters: {
            query?: never;
            header: {
                "user-agent": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkspaceSelectionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSuccessResponseDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthErrorResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthErrorResponseDto"];
                };
            };
        };
    };
    AuthController_refresh_v1: {
        parameters: {
            query?: never;
            header: {
                "x-requested-with": string;
                "X-Requested-With": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSuccessResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthErrorResponseDto"];
                };
            };
            /** @description Missing CSRF request header */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthErrorResponseDto"];
                };
            };
        };
    };
    AuthController_switchWorkspace_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SwitchWorkspaceDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthSuccessResponseDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthErrorResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthErrorResponseDto"];
                };
            };
        };
    };
    AuthController_logout_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LogoutResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthErrorResponseDto"];
                };
            };
        };
    };
    PlatformControlController_current_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Resolved permissions, features, license, branding, and manifest */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlatformCurrentResponseDto"];
                };
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_manifest_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_updateManifest_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateManifestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_features_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_updateFeature_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateFeatureDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_license_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_branding_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_updateBranding_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateBrandingDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_updatePermissionOverride_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePermissionOverrideDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_roles_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_createRole_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateRoleDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_deleteRole_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roleId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_updateRole_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roleId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateRoleDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_permissions_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_grant_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roleId: string;
                permissionCode: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_revoke_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roleId: string;
                permissionCode: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_assignRole_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                userId: string;
                roleId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_removeRole_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_temporaryRole_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TemporaryRoleDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PlatformControlController_temporaryPermission_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TemporaryPermissionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and declared permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateWorkspaceDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkspaceResponseDto"];
                };
            };
            /** @description A valid workspace-bound access token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description An active membership with workspace.read is required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_softDelete_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateWorkspaceDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_suspend_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_members_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_invite_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InviteMemberDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_accept_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvitationTokenDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_reject_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvitationTokenDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_revokeInvitation_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_remove_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_suspendMember_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_restoreMember_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkspaceController_updateMemberRole_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMemberRoleDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AiController_discover_v1: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional correlation ID; a generated value is returned when omitted */
                "x-request-id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Workspace provider discovery */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiProviderResponseDto"][];
                };
            };
            /** @description A valid bearer token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active tenant membership and permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AiController_providerConfiguration_v1: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional correlation ID; a generated value is returned when omitted */
                "x-request-id"?: string;
            };
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderConfigurationResponseDto"];
                };
            };
            /** @description A valid bearer token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active tenant membership and permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AiController_configureProvider_v1: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional correlation ID; a generated value is returned when omitted */
                "x-request-id"?: string;
            };
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfigureProviderDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderConfigurationResponseDto"];
                };
            };
            /** @description A valid bearer token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active tenant membership and permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AiController_validateProvider_v1: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional correlation ID; a generated value is returned when omitted */
                "x-request-id"?: string;
            };
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderValidationResponseDto"];
                };
            };
            /** @description A valid bearer token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active tenant membership and permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AiController_resolveRoute_v1: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional correlation ID; a generated value is returned when omitted */
                "x-request-id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AiRoutingRequestDto"];
            };
        };
        responses: {
            /** @description Provider-neutral routing decision */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiRoutingResponseDto"];
                };
            };
            /** @description Invalid routing requirements */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiErrorResponseDto"];
                };
            };
            /** @description A valid bearer token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active tenant membership and permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description No eligible provider model satisfies the requirements */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiErrorResponseDto"];
                };
            };
        };
    };
    AiController_listInvocations_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                status?: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "BLOCKED";
                providerId?: string;
                modelId?: string;
            };
            header?: {
                /** @description Optional correlation ID; a generated value is returned when omitted */
                "x-request-id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated provider execution history */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A valid bearer token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active tenant membership and permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AiController_invoke_v1: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional correlation ID; a generated value is returned when omitted */
                "x-request-id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AiInvocationRequestDto"];
            };
        };
        responses: {
            /** @description Normalized AI response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiInvocationResponseDto"];
                };
            };
            /** @description Invalid invocation request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiErrorResponseDto"];
                };
            };
            /** @description A valid bearer token is required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active tenant membership and permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Provider execution was cancelled or timed out */
            408: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiErrorResponseDto"];
                };
            };
            /** @description No eligible provider model is available */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiErrorResponseDto"];
                };
            };
            /** @description The selected provider rate limit was exceeded */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiErrorResponseDto"];
                };
            };
            /** @description The invocation could not be completed */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiErrorResponseDto"];
                };
            };
            /** @description The provider returned an invalid response */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiErrorResponseDto"];
                };
            };
            /** @description Provider execution or credentials are unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AiErrorResponseDto"];
                };
            };
        };
    };
    CustomProviderController_list_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Custom Providers with safe credential metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderResponseDto"][];
                };
            };
        };
    };
    CustomProviderController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCustomProviderDto"];
            };
        };
        responses: {
            /** @description Registered Custom Provider */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderResponseDto"];
                };
            };
        };
    };
    CustomProviderController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Custom Provider with safe credential metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderResponseDto"];
                };
            };
        };
    };
    CustomProviderController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCustomProviderDto"];
            };
        };
        responses: {
            /** @description Updated Custom Provider */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderResponseDto"];
                };
            };
        };
    };
    CustomProviderController_enable_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderResponseDto"];
                };
            };
        };
    };
    CustomProviderController_disable_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderResponseDto"];
                };
            };
        };
    };
    CustomProviderController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderResponseDto"];
                };
            };
        };
    };
    CustomProviderController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderResponseDto"];
                };
            };
        };
    };
    CustomProviderController_listCredentials_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderCredentialMetadataDto"][];
                };
            };
        };
    };
    CustomProviderController_replaceCredential_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomProviderCredentialDto"];
            };
        };
        responses: {
            /** @description Safe credential metadata; secret is never returned */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderCredentialWriteResponseDto"];
                };
            };
        };
    };
    CustomProviderController_validate_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomProviderValidationResponseDto"];
                };
            };
        };
    };
    ModelCatalogController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                source?: "BUILT_IN" | "PROVIDER_SYNCED" | "CUSTOM";
                status?: "ACTIVE" | "DISABLED" | "DEPRECATED" | "ARCHIVED";
                providerId?: string;
                customProviderId?: string;
                /** @description Require trusted upstream catalog SUPPORTED evidence; not a final runtime eligibility decision */
                capability?: "TEXT_CHAT" | "STREAMING" | "TOOLS" | "STRUCTURED_OUTPUT" | "REASONING" | "VISION_INPUT" | "IMAGE_GENERATION" | "AUDIO_INPUT" | "AUDIO_OUTPUT" | "VIDEO" | "EMBEDDINGS" | "AUDIO" | "FUNCTION_CALLING";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogPageResponseDto"];
                };
            };
        };
    };
    ModelCatalogController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCustomModelDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogModelResponseDto"];
                };
            };
        };
    };
    ModelCatalogController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                modelId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogModelResponseDto"];
                };
            };
        };
    };
    ModelCatalogController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                modelId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCustomModelDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogModelResponseDto"];
                };
            };
        };
    };
    ModelCatalogController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                modelId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogModelResponseDto"];
                };
            };
        };
    };
    ModelCatalogController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                modelId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogModelResponseDto"];
                };
            };
        };
    };
    DashboardRuntimeController_bootstrap_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardRuntimeBootstrapDto"];
                };
            };
            /** @description Active workspace membership and platform.read permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StudioProjectController_list_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StudioProjectController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateStudioProjectDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StudioProjectController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StudioProjectController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateStudioProjectDraftDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StudioProjectController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StudioProjectController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishStudioProjectDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StudioProjectController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackStudioProjectDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StudioProjectController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                search?: string;
                status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
                categoryId?: string;
                tagIds?: string[];
                favorite?: boolean;
                /** @description Return archived prompts only */
                archived?: boolean;
                sortBy?: "name" | "createdAt" | "updatedAt" | "revision";
                sortOrder?: "asc" | "desc";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePromptDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_categories_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_createCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PromptNamedDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_updateCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePromptNamedDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_deleteCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The category is assigned to a prompt */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_tags_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_createTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PromptNamedDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_updateTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePromptNamedDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_deleteTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The tag is assigned to a prompt */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_get_v1: {
        parameters: {
            query: {
                includeArchived: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Prompt not found in this workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePromptDraftDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_delete_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Only unreferenced draft prompts can be deleted */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_updateMetadata_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePromptMetadataDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishPromptDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackPromptDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_clone_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClonePromptDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_favorite_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FavoritePromptDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_assignTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                tagId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptLibraryController_removeTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                tagId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                search?: string;
                status?: "DRAFT" | "ACTIVE" | "DISABLED" | "PUBLISHED" | "ARCHIVED";
                visibility?: "PRIVATE" | "WORKSPACE";
                category?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAgentDto"];
            };
        };
        responses: {
            /** @description Agent configuration or a referenced resource is invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent name or slug already exists in the workspace */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAgentDraftDto"];
            };
        };
        responses: {
            /** @description Only draft agents can be edited */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_delete_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_updateOperationalPersonality_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateOperationalPersonalityDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_updateConversationHistory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateConversationHistoryDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_updateAutomaticExecution_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAutomaticExecutionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishAgentDto"];
            };
        };
        responses: {
            /** @description Only draft agents can be published */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackAgentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_clone_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CloneAgentDto"];
            };
        };
        responses: {
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Clone name or slug already exists in the workspace */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_switch_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
                connectionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SwitchChannelAgentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_bindRetrievalRuntime_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BindRetrievalRuntimeDto"];
            };
        };
        responses: {
            /** @description Bound RetrievalRuntime is missing or not published */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentStudioController_unbindRetrievalRuntime_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and the endpoint-specific Agent Studio permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentRuntimeController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                status?: "PREPARED" | "VALIDATED" | "REJECTED" | "SNAPSHOTTED";
                agentId?: string;
                conversationId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Agent Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentRuntimeController_prepare_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PrepareAgentRuntimeDto"];
            };
        };
        responses: {
            /** @description Agent, prompts, provider, profile, context, or variables are not runtime-ready */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Agent Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentRuntimeController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Agent Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentRuntimeController_validate_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Agent Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentRuntimeController_resolve_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Stored preparation can no longer be resolved */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Agent Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentRuntimeController_snapshot_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Agent Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime already has an immutable snapshot */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentRuntimeController_getSnapshot_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Agent Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Agent runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptCompilerController_compile_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompilePromptDto"];
            };
        };
        responses: {
            /** @description Prompt sources, variables, templates, versions, or ownership are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Prompt Compiler permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Compiled prompt was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptCompilerController_preview_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompilePromptDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Prompt Compiler permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Compiled prompt was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptCompilerController_validate_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompilePromptDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Prompt Compiler permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Compiled prompt was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptCompilerController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                promptId?: string;
                promptVersionId?: string;
                agentVersionId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Prompt Compiler permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Compiled prompt was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptCompilerController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Prompt Compiler permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Compiled prompt was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptCompilerController_compare_v1: {
        parameters: {
            query: {
                leftId: string;
                rightId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Prompt Compiler permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Compiled prompt was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptExecutionController_list_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Prompt Execution permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Prompt package or execution payload was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptExecutionController_render_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RenderPromptExecutionDto"];
            };
        };
        responses: {
            /** @description Prompt hash, variables, conditions, or references are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Prompt Execution permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Prompt package or execution payload was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptExecutionController_validate_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RenderPromptExecutionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Prompt Execution permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Prompt package or execution payload was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptExecutionController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Prompt Execution permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Prompt package or execution payload was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProviderRuntimeController_listRequests_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                status?: "PREPARED" | "VALIDATED" | "REJECTED" | "SNAPSHOTTED";
                providerId?: string;
                modelId?: string;
                executionRequestId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Provider Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Provider Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProviderRuntimeController_prepare_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PrepareProviderRequestDto"];
            };
        };
        responses: {
            /** @description Provider sources or requested capabilities are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Provider Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Provider Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProviderRuntimeController_validate_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Provider Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Provider Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProviderRuntimeController_createSnapshot_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Provider Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Provider Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProviderRuntimeController_getRequest_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Provider Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Provider Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProviderRuntimeController_compare_v1: {
        parameters: {
            query: {
                leftId: string;
                rightId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Provider Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Provider Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProviderRuntimeController_listSnapshots_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                requestId?: string;
                providerId?: string;
                modelId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Provider Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Provider Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ProviderRuntimeController_getSnapshot_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Provider Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Provider Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_list_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateExecutionPipelineDto"];
            };
        };
        responses: {
            /** @description Pipeline graph, variables, or immutable asset references are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_softDelete_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateExecutionPipelineDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_validate_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackExecutionPipelineDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_clone_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CloneExecutionPipelineDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_compare_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_listSnapshots_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionPipelineController_getSnapshot_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Pipeline permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution Pipeline resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_listRequests_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                sourceType?: "PROFILE" | "WORKFLOW" | "AGENT" | "PROMPT" | "KNOWLEDGE" | "TOOL" | "PROVIDER" | "WORKSPACE" | "MANUAL" | "SYSTEM";
                correlationId?: string;
                requestedById?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_createRequest_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateExecutionRequestDto"];
            };
        };
        responses: {
            /** @description Source reference, priority, correlation, or idempotency metadata is invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Idempotency key was reused with a different request */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_getRequest_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_createRun_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateExecutionRunDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_listRuns_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                status?: "REQUESTED" | "QUEUED" | "STARTING" | "RUNNING" | "PAUSED" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
                requestId?: string;
                correlationId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_getRun_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_transition_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransitionExecutionDto"];
            };
        };
        responses: {
            /** @description Requested lifecycle transition is invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Expected state version is stale or state changed concurrently */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_cancel_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CancelExecutionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_recordFailure_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordExecutionFailureDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_recordStep_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordExecutionStepDto"];
            };
        };
        responses: {
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Step sequence already exists or run is terminal */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_appendEvent_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AppendExecutionEventDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExecutionKernelController_appendLog_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AppendExecutionLogDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Execution Kernel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution record was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentExecutionController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                status?: "PREPARING" | "READY" | "FAILED" | "CANCELLED";
                correlationId?: string;
                executionRequestId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Agent Execution permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution or runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentExecutionController_prepare_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PrepareAgentExecutionDto"];
            };
        };
        responses: {
            /** @description Runtime dependencies or lifecycle state are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Agent Execution permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution or runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentExecutionController_cancel_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CancelAgentExecutionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Agent Execution permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution or runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AgentExecutionController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Agent Execution permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution or runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UnifiedAgentExecutionController_execute_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExecuteAgentExecutionDto"];
            };
        };
        responses: {
            /** @description Runtime dependencies or the rendered prompt are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and execution permissions required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UnifiedAgentExecutionController_stream_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StreamAgentExecutionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and execution permissions required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UnifiedAgentExecutionController_cancelStream_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and execution permissions required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    UnifiedAgentExecutionController_events_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and execution permissions required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_list_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_prepare_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PrepareConversationRuntimeDto"];
            };
        };
        responses: {
            /** @description Conversation metadata or referenced resources are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_validate_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_transition_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransitionConversationStateDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackConversationRuntimeDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_clone_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CloneConversationRuntimeDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_softDelete_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_compare_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_listSnapshots_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationRuntimeController_getSnapshot_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Conversation Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Conversation Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOptimizationController_cacheCompiled_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CacheCompiledPromptDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime Optimization permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Immutable runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOptimizationController_cacheRendered_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CacheRenderedPromptDto"];
            };
        };
        responses: {
            /** @description Variables are dynamic or not deterministic */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime Optimization permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Immutable runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOptimizationController_createContext_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateRuntimeContextSnapshotDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime Optimization permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Immutable runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOptimizationController_cacheRetrieval_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CacheRetrievalRuntimeDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime Optimization permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Immutable runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOptimizationController_cacheImmutable_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CacheImmutablePackageDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime Optimization permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Immutable runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOptimizationController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime Optimization permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Immutable runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOptimizationController_invalidate_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvalidateOptimizationPackageDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime Optimization permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Immutable runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOptimizationController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                type?: "COMPILED_PROMPT" | "RENDERED_PROMPT" | "PROVIDER_PROMPT" | "CONVERSATION_PREFIX" | "STUDIO_CONFIGURATION" | "RUNTIME_CONTEXT" | "RETRIEVAL_RUNTIME" | "MEMORY_RUNTIME" | "TOOL_DEFINITION" | "WORKFLOW_PACKAGE" | "EXECUTION_PLAN";
                sourceHash?: string;
                scopeKey?: string;
                status?: "ACTIVE" | "INVALIDATED";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime Optimization permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Immutable runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOptimizationController_metrics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime Optimization permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Immutable runtime asset was not found in the workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StreamingRuntimeController_list_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Streaming Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StreamingRuntimeController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Streaming Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StreamingRuntimeController_cancel_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Streaming Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StreamingRuntimeController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Streaming Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StreamingRuntimeController_metrics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Streaming Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StreamingRuntimeController_diagnostics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Streaming Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StreamingRuntimeController_chunks_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Streaming Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StreamingRuntimeController_compare_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Streaming Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    StreamingRuntimeController_events_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Streaming Runtime permission required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                type?: "CONVERSATION" | "SESSION" | "WORKSPACE" | "AGENT" | "EXECUTION" | "TEMPORARY_RUNTIME" | "SHARED_RUNTIME" | "REFERENCE";
                status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
                scopeKey?: string;
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateMemoryRuntimeDto"];
            };
        };
        responses: {
            /** @description Memory scope, ownership, or references are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMemoryRuntimeDto"];
            };
        };
        responses: {
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory state version changed */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackMemoryRuntimeDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_resolve_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResolveMemoryRuntimeDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_commit_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CommitMemoryWritesDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_compare_v1: {
        parameters: {
            query: {
                leftId: string;
                rightId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_snapshots_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                runtimeId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_snapshot_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_diagnostics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_metrics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MemoryRuntimeController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Memory Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Memory Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalExecutionController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                status?: "COMPLETED" | "FAILED" | "CANCELLED";
                mode?: "KEYWORD" | "SEMANTIC" | "HYBRID";
                retrievalRuntimeSnapshotId?: string;
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Retrieval Execution permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalExecutionController_execute_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExecuteRetrievalDto"];
            };
        };
        responses: {
            /** @description Retrieval dependencies, integrity, compatibility, or query are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Retrieval Execution permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalExecutionController_diagnostics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Retrieval Execution permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalExecutionController_metrics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Retrieval Execution permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalExecutionController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and Retrieval Execution permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRuntimeController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                status?: "CREATED" | "QUEUED" | "PREPARING" | "RUNNING" | "STREAMING" | "COMPLETED" | "CANCELLED" | "FAILED" | "TIMED_OUT";
                toolId?: string;
                toolVersionId?: string;
                correlationId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and tool permissions are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool version, execution, or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRuntimeController_execute_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExecuteToolDto"];
            };
        };
        responses: {
            /** @description Tool input, output, policy, compatibility, or dependency is invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and tool permissions are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool version, execution, or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool snapshot integrity or execution state changed */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRuntimeController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and tool permissions are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool version, execution, or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRuntimeController_cancel_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CancelToolExecutionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and tool permissions are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool version, execution, or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRuntimeController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and tool permissions are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool version, execution, or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRuntimeController_diagnostics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and tool permissions are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool version, execution, or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRuntimeController_metrics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and tool permissions are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool version, execution, or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRuntimeController_persistedEvents_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and tool permissions are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool version, execution, or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRuntimeController_stream_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and tool permissions are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool version, execution, or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_categories_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_createCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ToolTaxonomyDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_updateCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateToolTaxonomyDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_deleteCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Category is in use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_groups_v1: {
        parameters: {
            query: {
                categoryId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_createGroup_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateToolGroupDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_updateGroup_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateToolGroupDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_deleteGroup_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Group is in use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                search?: string;
                status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
                type?: "INTERNAL" | "HTTP" | "REST" | "WEBHOOK" | "DATABASE" | "FILE" | "STORAGE" | "WORKFLOW" | "AGENT" | "COMPOSITE" | "OPENAPI" | "INTERNAL_SERVICE" | "FUNCTION" | "MCP";
                visibility?: "PRIVATE" | "WORKSPACE";
                categoryId?: string;
                groupId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateToolDefinitionDto"];
            };
        };
        responses: {
            /** @description Tool metadata, schema, permission, or taxonomy is invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateToolDefinitionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_delete_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishToolDefinitionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackToolDefinitionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_clone_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CloneToolDefinitionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ToolRegistryController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Tool Registry permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tool Registry resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowRuntimeController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                status?: "CREATED" | "QUEUED" | "PREPARING" | "RUNNING" | "WAITING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED" | "TIMED_OUT" | "COMPENSATED";
                workflowId?: string;
                workflowVersionId?: string;
                correlationId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and workflow runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow execution or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowRuntimeController_execute_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExecuteWorkflowDto"];
            };
        };
        responses: {
            /** @description Workflow graph, input, node configuration, or dependency is invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and workflow runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow execution or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow snapshot integrity or execution state changed */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowRuntimeController_cancel_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CancelWorkflowExecutionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and workflow runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow execution or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowRuntimeController_approve_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResolveApprovalDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and workflow runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow execution or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowRuntimeController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and workflow runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow execution or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowRuntimeController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and workflow runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow execution or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowRuntimeController_diagnostics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and workflow runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow execution or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowRuntimeController_metrics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and workflow runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow execution or dependency was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                status?: "PREPARED" | "PUBLISHED" | "ARCHIVED" | "REJECTED";
                knowledgeBaseId?: string;
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_prepare_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PrepareRetrievalRuntimeDto"];
            };
        };
        responses: {
            /** @description Knowledge references or retrieval metadata are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_validate_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_compare_v1: {
        parameters: {
            query: {
                leftId: string;
                rightId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_listSnapshots_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                runtimeId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_getSnapshot_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RetrievalRuntimeController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Retrieval Runtime permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Retrieval Runtime resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_spaces_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_createSpace_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateKnowledgeSpaceDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_updateSpace_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateKnowledgeSpaceDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_deleteSpace_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge space must be empty */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_publishSpace_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Space contains missing, failed, or unpublished knowledge documents */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_collections_v1: {
        parameters: {
            query: {
                spaceId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_createCollection_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateKnowledgeCollectionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_updateCollection_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateKnowledgeCollectionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_deleteCollection_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_folders_v1: {
        parameters: {
            query: {
                spaceId: string;
                collectionId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_createFolder_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateKnowledgeFolderDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_updateFolder_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateKnowledgeFolderDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_deleteFolder_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_categories_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_createCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["KnowledgeNamedDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_updateCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateKnowledgeNamedDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_deleteCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_tags_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_createTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["KnowledgeNamedDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_updateTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateKnowledgeNamedDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_deleteTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_documents_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                search?: string;
                spaceId?: string;
                collectionId?: string;
                folderId?: string;
                status?: "DRAFT" | "INDEXING" | "READY" | "FAILED" | "ARCHIVED" | "PUBLISHED";
                sourceType?: "FILE" | "URL" | "TEXT" | "IMPORT" | "API";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_createDocument_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateKnowledgeDocumentDto"];
            };
        };
        responses: {
            /** @description Document hierarchy or metadata is invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_document_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_updateDocument_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateKnowledgeDocumentDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_deleteDocument_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_uploadDocument_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UploadKnowledgeDocumentDto"];
            };
        };
        responses: {
            /** @description Unsupported file type or missing upload field */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Document slug already exists in the workspace */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_createTextDocument_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateKnowledgeTextDocumentDto"];
            };
        };
        responses: {
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Document slug already exists in the workspace */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishKnowledgeDocumentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackKnowledgeDocumentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_clone_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CloneKnowledgeDocumentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    KnowledgeBaseController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Knowledge Base permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Knowledge resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_categories_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_createCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkflowTaxonomyDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_updateCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateWorkflowTaxonomyDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_deleteCategory_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Category is in use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_tags_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_createTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkflowTaxonomyDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_updateTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateWorkflowTaxonomyDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_deleteTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tag is in use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                search?: string;
                status?: "DRAFT" | "PUBLISHED" | "ACTIVE" | "PAUSED" | "ARCHIVED";
                visibility?: "PRIVATE" | "WORKSPACE";
                categoryId?: string;
                tagId?: string;
                sortBy?: "name" | "createdAt" | "updatedAt" | "publishedAt";
                sortOrder?: "asc" | "desc";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateWorkflowDto"];
            };
        };
        responses: {
            /** @description Graph topology, workspace references, metadata, or permission requirements are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateWorkflowDto"];
            };
        };
        responses: {
            /** @description Only drafts may be edited and the complete draft graph must be valid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_delete_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishWorkflowDto"];
            };
        };
        responses: {
            /** @description Workflow graph is incomplete or invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackWorkflowDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_clone_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CloneWorkflowDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    WorkflowEngineController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Workflow Engine permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Workflow resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_queues_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_createQueue_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrchestrationTaxonomyDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_updateQueue_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateOrchestrationTaxonomyDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_deleteQueue_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Queue definition is in use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_priorities_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_createPriority_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExecutionPriorityLevelDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_updatePriority_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateExecutionPriorityLevelDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_deletePriority_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Priority level is in use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_tags_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_createTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrchestrationTaxonomyDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_updateTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateOrchestrationTaxonomyDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_deleteTag_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Execution tag is in use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_list_v1: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
                search?: string;
                status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
                visibility?: "PRIVATE" | "WORKSPACE";
                queueDefinitionId?: string;
                priorityLevelId?: string;
                tagId?: string;
                sortBy?: "name" | "createdAt" | "updatedAt" | "publishedAt";
                sortOrder?: "asc" | "desc";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateExecutionProfileDto"];
            };
        };
        responses: {
            /** @description Policies, dependencies, limits, or workspace references are invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_update_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateExecutionProfileDto"];
            };
        };
        responses: {
            /** @description Only drafts may be edited and all orchestration metadata must remain valid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_delete_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_history_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_publish_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublishExecutionProfileDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_rollback_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RollbackExecutionProfileDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_clone_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CloneExecutionProfileDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_archive_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    RuntimeOrchestrationController_restore_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active membership and endpoint-specific Runtime Orchestration permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Runtime orchestration resource was not found in the active workspace */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_list_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_create_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateChannelDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_get_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_providers_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_capabilities_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_refreshCapabilities_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                providerKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_providerConnection_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProviderConnectionDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_connections_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_connection_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateChannelConnectionDto"];
            };
        };
        responses: {
            /** @description Meta connection configuration is invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_phoneNumbers_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_health_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_connectionDiagnostics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_reconnect_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_disconnect_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_newPairing_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_configurations_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_updateConnection_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateChannelConnectionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_updateConfiguration_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateChannelConfigurationDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_connectionState_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransitionChannelConnectionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_rotateCredential_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RotateChannelCredentialDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_batches_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_createBatch_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateChannelBatchDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_regenerateVerifyToken_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_verify_v1: {
        parameters: {
            query: {
                "hub.mode": string;
                "hub.verify_token": string;
                "hub.challenge": string;
            };
            header?: never;
            path: {
                pathKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_webhook_v1: {
        parameters: {
            query?: never;
            header: {
                "x-hub-delivery-timestamp"?: string;
                "x-hub-signature-256": string;
            };
            path: {
                pathKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signature or replay-window validation failed */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_verifyProvider_v1: {
        parameters: {
            query: {
                "hub.mode": string;
                "hub.verify_token": string;
                "hub.challenge": string;
            };
            header?: never;
            path: {
                pathKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_providerWebhook_v1: {
        parameters: {
            query?: never;
            header: {
                "x-channel-timestamp": string;
                "x-hub-delivery-timestamp": string;
            };
            path: {
                pathKey: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_send_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SendChannelMessageDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_transition_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransitionChannelMessageDto"];
            };
        };
        responses: {
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Optimistic state version changed */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_messages_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_message_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_attachments_v1: {
        parameters: {
            query: {
                channelId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_upload_v1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UploadChannelAttachmentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_attachment_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_conversations_v1: {
        parameters: {
            query: {
                channelId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_setConversationExecution_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetConversationExecutionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_diagnostics_v1: {
        parameters: {
            query: {
                channelId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ChannelRuntimeController_metrics_v1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Active workspace membership and channel permission are required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
