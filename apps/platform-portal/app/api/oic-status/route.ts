import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = process.env.OIC_API_INTERNAL_URL ?? "http://127.0.0.1:4100";
  try {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500)
    });
    return NextResponse.json({ available: response.ok }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
