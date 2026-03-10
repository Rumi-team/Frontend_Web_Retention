"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const ALLOWED_EMAILS = ["ali@rumi.team"];

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      const msg = errorDescription || error;
      router.replace(`/login?error=${encodeURIComponent(msg)}`);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    // With implicit flow, the session token arrives in the URL hash fragment.
    // The Supabase client detects it automatically and fires SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const email = session.user.email?.toLowerCase();

          if (!email || !ALLOWED_EMAILS.includes(email)) {
            setStatus("Access denied. Signing out...");
            await supabase.auth.signOut();
            router.replace(
              `/login?error=${encodeURIComponent(
                "Access restricted. Only authorized emails may sign in."
              )}`
            );
            return;
          }

          if (session.user.app_metadata?.access_verified) {
            router.replace("/admin/retention");
          } else {
            router.replace("/verify");
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
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
