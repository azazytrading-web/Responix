"use client";

import { useState } from "react";
import type { AuthWorkspace } from "@responix/auth";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@responix/auth";
import { Button, Input, Label, Spinner } from "@responix/ui";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { login, selectWorkspace } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [workspaceChoices, setWorkspaceChoices] = useState<AuthWorkspace[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.status === "workspace-selection-required") {
        setWorkspaceChoices(result.workspaces);
      } else {
        router.replace("/");
      }
    } catch {
      setError(t("invalidCredentials"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkspaceSelection = async (workspaceId: string) => {
    setError("");
    setIsLoading(true);
    try {
      await selectWorkspace(workspaceId);
      router.replace("/");
    } catch {
      setError(t("invalidCredentials"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center space-y-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-xl font-bold">R</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("signIn")}</h1>
        <p className="text-sm text-muted-foreground">{t("signInDescription")}</p>
      </div>

      {workspaceChoices.length > 0 ? (
        <div className="space-y-3">
          {workspaceChoices.map((choice) => (
            <Button
              key={choice.id}
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading}
              onClick={() => { void handleWorkspaceSelection(choice.id); }}
            >
              {choice.name}
            </Button>
          ))}
        </div>
      ) : (
      /* Form */
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <Spinner className="mr-2 h-4 w-4" />
          ) : (
            <LogIn className="mr-2 h-4 w-4" />
          )}
          {t("submit")}
        </Button>
      </form>
      )}
    </div>
  );
}
