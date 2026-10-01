import { NextResponse } from "next/server";
import {
  consoleConfigurationReady,
  createConsoleSession,
  destroyConsoleSession,
  hasConsoleSession,
  sameOrigin,
  verifyOperatorPassword
} from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { authenticated: await hasConsoleSession(), configured: consoleConfigurationReady() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  if (!consoleConfigurationReady())
    return NextResponse.json(
      { error: "Console authentication is not configured on this server." },
      { status: 503 }
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const password =
    body && typeof body === "object" && "password" in body && typeof body.password === "string"
      ? body.password
      : "";
  if (!verifyOperatorPassword(password))
    return NextResponse.json({ error: "Access could not be verified." }, { status: 401 });
  await createConsoleSession();
  return NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  await destroyConsoleSession();
  return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
}
