"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@responix/auth";
import { cn } from "@responix/ui";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";

export function WorkspaceSwitcher() {
  const t = useTranslations("workspace");
  const { workspace, workspaces, switchWorkspace } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!workspace) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-accent",
          isOpen && "bg-accent"
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{workspace.name}</p>
          <p className="truncate text-xs text-muted-foreground">{t("current")}</p>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover p-1 shadow-md">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {t("workspaces")}
          </div>
          {workspaces.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">{t("noWorkspaces")}</div>
          ) : (
            workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  void switchWorkspace(ws.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                  ws.id === workspace.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                )}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <span className="flex-1 truncate text-left">{ws.name}</span>
                {ws.id === workspace.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))
          )}
          <div className="my-1 border-t border-border" />
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
            onClick={() => setIsOpen(false)}
          >
            <Plus className="h-4 w-4" />
            <span>{t("switch")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
