"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@responix/ui";
import { Search } from "lucide-react";
import { NavigationRegistry, resolveIcon, useResolvedNavigation } from "../navigation";
import { usePlatformBootstrap } from "../platform";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

const emptyRegistry = new NavigationRegistry();

export function CommandPalette() {
  const t = useTranslations("commandPalette");
  const router = useRouter();
  const { navigationRegistry } = usePlatformBootstrap();
  const navigation = useResolvedNavigation(navigationRegistry ?? emptyRegistry, "sidebar");
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const commands: CommandItem[] = navigation.flatMap((item) => {
    if (!item.route) return [];
    return [{
      id: item.id,
      label: `${t("navigation")}: ${item.label}`,
      icon: resolveIcon(item.icon?.name) ?? Search,
      action: () => router.push(item.route!)
    }];
  });

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 pt-[20vh] p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-popover shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("noResults")}
            </div>
          ) : (
            filtered.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
