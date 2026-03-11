import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EMAILS = ["ali@rumi.team"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const msg = errorDescription || error;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(msg)}`
    );
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s+/g, ""),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s+/g, ""),
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    // Verify email allowlist
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email || !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Access restricted. Only authorized emails may sign in.")}`
      );
    }

    // Redirect based on access_verified status
    if (user.app_metadata?.access_verified) {
      return NextResponse.redirect(`${origin}/admin/retention`);
    }
    return NextResponse.redirect(`${origin}/verify`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("No authorization code received")}`
  );
}
