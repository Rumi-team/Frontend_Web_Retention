"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const ALLOWED_EMAILS = ["ali@rumi.team"];

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Completing sign in...");
  const [deniedEmail, setDeniedEmail] = useState("");

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
          const email = session.user.email?.toLowerCase() ?? "";

          if (!email || !ALLOWED_EMAILS.includes(email)) {
            setDeniedEmail(session.user.email ?? email);
            setStatus("is not authorized to access this dashboard.");
            await supabase.auth.signOut();
            setTimeout(() => {
              router.replace("/login");
            }, 3000);
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

  if (deniedEmail) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 w-full max-w-sm text-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rumi_logo.png" alt="Rumi" className="h-10 w-auto mx-auto" />
          <p className="text-red-400 text-sm font-medium">Access Denied</p>
          <p className="text-gray-400 text-sm">
            <span className="text-white font-mono">{deniedEmail}</span>{" "}
            is not authorized to access this dashboard.
          </p>
          <p className="text-gray-600 text-xs">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

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
