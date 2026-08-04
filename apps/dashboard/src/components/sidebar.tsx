"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@responix/auth";
import { cn } from "@responix/ui";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LogOut, User, Menu, X } from "lucide-react";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { useResolvedNavigation, resolveIcon } from "../navigation";
import { usePlatformBootstrap } from "../platform";

export function useNavigationRegistry() {
  const { navigationRegistry } = usePlatformBootstrap();
  if (!navigationRegistry) throw new Error("Navigation was consumed before platform bootstrap completed");
  return navigationRegistry;
}

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const t = useTranslations("nav");
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const registry = useNavigationRegistry();
  const navItems = useResolvedNavigation(registry, "sidebar");

  // Group items by group field or default to single group
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof navItems> = {};
    for (const item of navItems) {
      if (item.depth !== 0) continue;
      const group = item.group ?? "default";
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    }
    return groups;
  }, [navItems]);

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-border px-3">
        <Link href="/" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            R
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">Responix</span>
          )}
        </Link>
        {mobileOpen && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Workspace Switcher */}
      {!collapsed && (
        <div className="border-b border-border p-3">
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-auto py-3 px-2 space-y-4">
        {Object.entries(groupedItems).map(([group, items]) => (
          <div key={group}>
            {!collapsed && group !== "default" && (
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(group)}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = resolveIcon(item.icon?.name);
                return (
                  <li key={item.id}>
                    <Link
                      href={item.route ?? "#"}
                      onClick={onMobileClose}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                        item.active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:block border-t border-border p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* User card */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{user?.fullName ?? "User"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => { void logout(); }}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-[var(--sidebar-width-icon)]" : "w-[var(--sidebar-width)]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] flex-col border-r border-border bg-card lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
