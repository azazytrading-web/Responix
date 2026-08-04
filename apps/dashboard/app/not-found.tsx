import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@responix/ui";

export default function NotFoundPage() {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-6xl font-bold tracking-tight text-muted-foreground">404</h1>
        <h2 className="text-2xl font-semibold tracking-tight">{t("noResults")}</h2>
        <p className="text-muted-foreground">{t("tryDifferentTerm")}</p>
      </div>
      <Link href="/">
        <Button>{t("back")}</Button>
      </Link>
    </div>
  );
}
