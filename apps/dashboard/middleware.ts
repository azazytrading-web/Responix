import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale } from "./src/lib/i18n/config";

const LOCALE_COOKIE = "NEXT_LOCALE";

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  if (!request.cookies.has(LOCALE_COOKIE)) {
    response.cookies.set(LOCALE_COOKIE, defaultLocale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]
};
