import ConsoleApp from "./console-app";

export const dynamic = "force-dynamic";

function platformDestination(): string {
  const configured = process.env.OI_PLATFORM_URL ?? "http://localhost:3000";
  try {
    const value = new URL(configured);
    return ["http:", "https:"].includes(value.protocol) ? value.toString() : "http://localhost:3000";
  } catch { return "http://localhost:3000"; }
}

export default function Page() {
  return <ConsoleApp platformUrl={platformDestination()} />;
}
