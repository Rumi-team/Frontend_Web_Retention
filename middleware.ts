import { NextRequest, NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

export function middleware(req: NextRequest) {
  // Allow cron calls through (they use CRON_SECRET in Authorization header)
  if (req.nextUrl.pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  // For API routes, no redirect needed
  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // If no ADMIN_SECRET configured, allow all (dev mode)
  if (!ADMIN_SECRET) return NextResponse.next();

  // Check cookie
  const token = req.cookies.get("admin_token")?.value;
  if (token === ADMIN_SECRET) return NextResponse.next();

  // Check Authorization header (for programmatic access)
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${ADMIN_SECRET}`) return NextResponse.next();

  // Redirect to login
  if (req.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
