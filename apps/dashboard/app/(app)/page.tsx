import { useTranslations } from "next-intl";

export default function DashboardHomePage() {
  const t = useTranslations("nav");

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard")}</h1>
        <p className="text-sm text-muted-foreground">
          Welcome to your Responix dashboard.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">Metric {i + 1}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">--</p>
          </div>
        ))}
      </div>
    </div>
  );
}
