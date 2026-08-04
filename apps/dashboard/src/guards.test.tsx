import { describe, it, expect } from "vitest";
import { PermissionGuard, AnyPermissionGuard, AllPermissionsGuard } from "@responix/auth";
import { render, screen } from "./testing/utils";
import { MockAuthProvider } from "./testing/mocks";

describe("PermissionGuard", () => {
  it("renders children when user has permission", () => {
    render(
      <MockAuthProvider permissions={["admin.read"]} isAuthenticated={true}>
        <PermissionGuard permission="admin.read">
          <div data-testid="protected">Protected Content</div>
        </PermissionGuard>
      </MockAuthProvider>
    );
    expect(screen.queryByTestId("protected")).toBeInTheDocument();
  });

  it("does not render children when permission is missing", () => {
    render(
      <MockAuthProvider permissions={[]} isAuthenticated={true}>
        <PermissionGuard permission="admin.read">
          <div data-testid="protected">Protected Content</div>
        </PermissionGuard>
      </MockAuthProvider>
    );
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });
});

describe("AnyPermissionGuard", () => {
  it("renders when any permission matches", () => {
    render(
      <MockAuthProvider permissions={["read"]} isAuthenticated={true}>
        <AnyPermissionGuard permissions={["read", "write"]}>
          <div data-testid="protected">Content</div>
        </AnyPermissionGuard>
      </MockAuthProvider>
    );
    expect(screen.queryByTestId("protected")).toBeInTheDocument();
  });
});

describe("AllPermissionsGuard", () => {
  it("renders when all permissions match", () => {
    render(
      <MockAuthProvider permissions={["read", "write"]} isAuthenticated={true}>
        <AllPermissionsGuard permissions={["read", "write"]}>
          <div data-testid="protected">Content</div>
        </AllPermissionsGuard>
      </MockAuthProvider>
    );
    expect(screen.queryByTestId("protected")).toBeInTheDocument();
  });

  it("does not render when not all permissions match", () => {
    render(
      <MockAuthProvider permissions={["read"]} isAuthenticated={true}>
        <AllPermissionsGuard permissions={["read", "write"]}>
          <div data-testid="protected">Content</div>
        </AllPermissionsGuard>
      </MockAuthProvider>
    );
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });
});
