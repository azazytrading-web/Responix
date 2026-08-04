import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border bg-background py-4 px-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>{t("designedBy")}</span>
          <span className="font-medium text-foreground">Responix</span>
        </div>
        <div>{t("version", { version: "0.4.0" })}</div>
      </div>
    </footer>
  );
}
