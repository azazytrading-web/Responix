import { Button } from "@responix/ui";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="max-w-2xl space-y-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Responix</p>
        <h1 className="text-4xl font-semibold tracking-tight">Enterprise AI Customer Engagement</h1>
        <p className="text-lg text-slate-600">
          Sprint 0 initializes the production-grade monorepo foundation for the Responix platform.
        </p>
        <Button>Foundation Ready</Button>
      </section>
    </main>
  );
}
