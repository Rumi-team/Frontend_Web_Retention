import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/admin/retention";

  // If Supabase returned an error (via query params)
  if (error) {
    const msg = errorDescription || error;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(msg)}`
    );
  }

  if (!code) {
    // No code and no error in query params — error may be in hash fragment
    // (hash fragments aren't sent to server, so client-side handling needed)
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // Default redirect: /verify (access code check), unless access already granted
  const verifyRedirect = NextResponse.redirect(`${origin}/verify`);

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
            verifyRedirect.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // Check if user already has access granted (re-login case)
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.app_metadata?.access_verified) {
    const response = NextResponse.redirect(`${origin}${next}`);
    verifyRedirect.cookies.getAll().forEach(({ name, value, ...options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  return verifyRedirect;
}
