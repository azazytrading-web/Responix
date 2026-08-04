"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@responix/auth";
import { Avatar, Separator } from "@responix/ui";
import { useLocale } from "next-intl";
import {
  Search,
  Sun,
  Moon,
  Monitor,
  Bell,
  Globe,
  ChevronRight,
  LogOut,
  Settings,
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

  return (
    <div className="flex items-center rounded-md border border-border p-0.5">
      <button
        onClick={() => setTheme("light")}
        className={`rounded p-1.5 transition-colors ${theme === "light" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-label="Light theme"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`rounded p-1.5 transition-colors ${theme === "dark" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-label="Dark theme"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`rounded p-1.5 transition-colors ${theme === "system" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-label="System theme"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <button
      onClick={() => switchLocale(locale === "en" ? "ar" : "en")}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      aria-label="Switch language"
    >
      <Globe className="h-3.5 w-3.5" />
      {locale === "en" ? "العربية" : "English"}
    </button>
  );
}

function NotificationBell() {
  const t = useTranslations("common");
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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label={t("notifications")}
      >
        <Bell className="h-4 w-4" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-md border border-border bg-popover p-1 shadow-md">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-medium">{t("notifications")}</span>
            <button className="text-xs text-primary hover:underline">{t("markAllRead")}</button>
          </div>
          <div className="border-t border-border py-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">{t("noNotifications")}</p>
          </div>
        </div>
      )}
    </div>
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
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Settings className="h-4 w-4" />
            {t("settings")}
          </Link>
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
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
