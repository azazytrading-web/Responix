import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@responix/ui";
import { Lock } from "lucide-react";

export default function UnauthorizedPage() {
  const t = useTranslations("auth");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center space-y-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("unauthorizedTitle")}</h1>
          <p className="text-muted-foreground max-w-sm">{t("unauthorizedDescription")}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="default">{t("signIn")}</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">{t("goHome")}</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
