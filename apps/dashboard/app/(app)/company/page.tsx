import { useTranslations } from "next-intl";

export default function CompanyDashboardPage() {
  const t = useTranslations("nav");

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("members")}</h1>
      <p className="text-muted-foreground">{t("membersDescription")}</p>
    </main>
  );
}
