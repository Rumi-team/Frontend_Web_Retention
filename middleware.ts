import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ALLOWED_EMAILS = ["ali@rumi.team"];

export async function middleware(req: NextRequest) {
  // Allow cron calls through (they validate CRON_SECRET per route)
  if (req.nextUrl.pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  // Allow landing page, login, and auth callback without session
  if (
    req.nextUrl.pathname === "/" ||
    req.nextUrl.pathname === "/login" ||
    req.nextUrl.pathname.startsWith("/auth/callback")
  ) {
    return NextResponse.next();
  }

  // Allow signout, verify-code, and exit-form APIs without access check
  if (
    req.nextUrl.pathname === "/api/auth/signout" ||
    req.nextUrl.pathname === "/api/auth/verify-code" ||
    req.nextUrl.pathname === "/api/exit-form" ||
    req.nextUrl.pathname === "/verify"
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s+/g, ""),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s+/g, ""),
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            response = NextResponse.next({
              request: { headers: req.headers },
            });
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // For API routes, return 401 if not authenticated
  if (req.nextUrl.pathname.startsWith("/api")) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Check email allowlist
    if (!user.email || !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return response;
  }

  // For UI routes, redirect to login if not authenticated
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check email allowlist
  if (!user.email || !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.redirect(
      new URL("/login?error=Access+restricted.+Only+authorized+emails+may+sign+in.", req.url)
    );
  }

  // Redirect to /verify if user hasn't entered their access code yet
  if (!user.app_metadata?.access_verified) {
    if (req.nextUrl.pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Access not granted" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/verify", req.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)"],
};
