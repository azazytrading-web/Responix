import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@responix/ui";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  const t = useTranslations("auth");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center space-y-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("forbiddenTitle")}</h1>
          <p className="text-muted-foreground max-w-sm">{t("forbiddenDescription")}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/">
            <Button variant="default">{t("goHome")}</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline">{t("signInAsDifferentUser")}</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
