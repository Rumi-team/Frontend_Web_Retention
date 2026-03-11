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
    const code = searchParams.get("code");

    async function handleAuth() {
      // If we have a PKCE code, exchange it first
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          router.replace(`/login?error=${encodeURIComponent(exchangeError.message)}`);
          return;
        }
      }

      // Check current session (works for both PKCE exchange and implicit flow)
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // For implicit flow, listen for the hash fragment
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === "SIGNED_IN" && session?.user) {
              await redirectUser(supabase, session.user);
            }
          }
        );
        // Clean up after 10s timeout
        setTimeout(() => {
          subscription.unsubscribe();
          router.replace("/login?error=Sign+in+timed+out");
        }, 10000);
        return;
      }

      await redirectUser(supabase, user);
    }

    async function redirectUser(supabase: ReturnType<typeof createSupabaseBrowserClient>, user: { email?: string | null; app_metadata?: Record<string, unknown> }) {
      const email = user.email?.toLowerCase() ?? "";

      if (!email || !ALLOWED_EMAILS.includes(email)) {
        setDeniedEmail(user.email ?? email);
        setStatus("is not authorized to access this dashboard.");
        await supabase.auth.signOut();
        setTimeout(() => {
          router.replace("/login");
        }, 3000);
        return;
      }

      if (user.app_metadata?.access_verified) {
        router.replace("/admin/retention");
      } else {
        router.replace("/verify");
      }
    }

    handleAuth();
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
