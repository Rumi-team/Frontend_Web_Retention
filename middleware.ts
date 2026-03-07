import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  // Allow signout and verify-code APIs without access check
  if (
    req.nextUrl.pathname === "/api/auth/signout" ||
    req.nextUrl.pathname === "/api/auth/verify-code" ||
    req.nextUrl.pathname === "/verify"
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    return response;
  }

  // For UI routes, redirect to login if not authenticated
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
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
