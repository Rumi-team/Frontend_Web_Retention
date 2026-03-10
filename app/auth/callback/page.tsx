"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Suspense } from "react";

const ALLOWED_EMAILS = ["ali@rumi.team"];

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      const msg = errorDescription || error;
      router.replace(`/login?error=${encodeURIComponent(msg)}`);
      return;
    }

    if (!code) {
      router.replace("/login?error=auth_callback_failed");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    supabase.auth.exchangeCodeForSession(code).then(async ({ error: exchangeError }) => {
      if (exchangeError) {
        router.replace(`/login?error=${encodeURIComponent(exchangeError.message)}`);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.email || !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
        setStatus("Access denied. Signing out...");
        await supabase.auth.signOut();
        router.replace(
          `/login?error=${encodeURIComponent("Access restricted. Only authorized emails may sign in.")}`
        );
        return;
      }

      if (user.app_metadata?.access_verified) {
        router.replace("/admin/retention");
      } else {
        router.replace("/verify");
      }
    });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-gray-400">{status}</div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
