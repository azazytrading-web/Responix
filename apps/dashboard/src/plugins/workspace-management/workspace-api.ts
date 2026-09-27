import { apiClient, type components } from "@responix/api-client";

export type WorkspaceDetails = components["schemas"]["WorkspaceResponseDto"];

export const WORKSPACE_EDITABLE_FIELDS = {
  name: { label: "Workspace name", maxLength: 120 },
  companyName: { label: "Company name", maxLength: 120 },
  country: { label: "Country", maxLength: 80 },
  timezone: { label: "Timezone", maxLength: 50 },
  language: { label: "Language", maxLength: 12 },
  currency: { label: "Currency", maxLength: 3 }
} as const;

export type WorkspaceEditableField = keyof typeof WORKSPACE_EDITABLE_FIELDS;
export type WorkspaceUpdateInput = Partial<Record<WorkspaceEditableField, string>>;

export function validateWorkspaceUpdate(input: Record<WorkspaceEditableField, string>) {
  const errors: Partial<Record<WorkspaceEditableField | "form", string>> = {};
  for (const field of Object.keys(WORKSPACE_EDITABLE_FIELDS) as WorkspaceEditableField[]) {
    const metadata = WORKSPACE_EDITABLE_FIELDS[field];
    if (input[field].length > metadata.maxLength) {
      errors[field] = `${metadata.label} must be ${metadata.maxLength} characters or fewer.`;
    }
  }
  return errors;
}

export function changedWorkspaceFields(
  current: Record<WorkspaceEditableField, string>,
  next: Record<WorkspaceEditableField, string>
): WorkspaceUpdateInput {
  return Object.fromEntries(
    (Object.keys(WORKSPACE_EDITABLE_FIELDS) as WorkspaceEditableField[])
      .filter((field) => current[field] !== next[field])
      .map((field) => [field, next[field]])
  );
}

export function getCurrentWorkspace(): Promise<WorkspaceDetails> {
  return apiClient.get<WorkspaceDetails>("/api/v1/workspaces/current", {
    credentials: "include"
  });
}

export function updateCurrentWorkspace(input: WorkspaceUpdateInput): Promise<WorkspaceDetails> {
  return apiClient.patch<WorkspaceDetails>("/api/v1/workspaces/current", input, {
    credentials: "include"
  });
}
