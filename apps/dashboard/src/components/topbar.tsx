"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@responix/auth";
import { Avatar, Separator } from "@responix/ui";
import { useLocale } from "next-intl";
import {
  Search,
  Sun,
  Moon,
  Monitor,
  Globe,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { MobileMenuButton } from "./sidebar";
import { useNavigationRegistry, useBreadcrumbs } from "../navigation";

function Breadcrumb() {
  const t = useTranslations("nav");
  const registry = useNavigationRegistry();
  const breadcrumbs = useBreadcrumbs(registry, t);

  if (breadcrumbs.length === 0) {
    return (
      <h1 className="text-lg font-semibold tracking-tight">{t("dashboard")}</h1>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      {breadcrumbs.map((item, i) => (
        <span key={item.id} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {item.active || !item.href ? (
            <span className="font-medium capitalize">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors capitalize"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");

  return (
    <div className="flex items-center rounded-md border border-border p-0.5">
      <button
        onClick={() => setTheme("light")}
        className={`rounded p-1.5 transition-colors ${theme === "light" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-label={t("light")}
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`rounded p-1.5 transition-colors ${theme === "dark" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-label={t("dark")}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`rounded p-1.5 transition-colors ${theme === "system" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-label={t("system")}
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("language");

  const switchLocale = (newLocale: string) => {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  };

  return (
    <button
      onClick={() => switchLocale(locale === "en" ? "ar" : "en")}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      aria-label={t("switch")}
    >
      <Globe className="h-3.5 w-3.5" />
      {locale === "en" ? t("arabic") : t("english")}
    </button>
  );
}

function ProfileMenu() {
  const t = useTranslations("auth");
  const { user, logout } = useAuth();
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Avatar fallback={user?.fullName?.[0] ?? "U"} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-border bg-popover p-1 shadow-md">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user?.fullName ?? "User"}</p>
            <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
          </div>
          <div className="my-1 border-t border-border" />
          <button
            onClick={() => {
              setIsOpen(false);
              void logout();
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      {onMenuClick && <MobileMenuButton onClick={onMenuClick} />}

      <div className="flex flex-1 items-center gap-4">
        <Breadcrumb />
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder={t("searchPlaceholder")}
            className="h-9 w-[200px] rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring lg:w-[280px]"
          />
        </div>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        <LanguageSwitcher />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
