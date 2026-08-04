"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, Input, Label, Spinner } from "@responix/ui";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 800));
      setIsSent(true);
    } catch {
      setError(t("requestFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("checkYourEmail")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("resetLinkSent", { email })}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("forgotPasswordTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("forgotPasswordDescription")}</p>
      </div>

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

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <Mail className="mr-2 h-4 w-4" />}
          {t("sendResetLink")}
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}
