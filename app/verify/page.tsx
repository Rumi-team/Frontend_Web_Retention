"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function VerifyForm() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const router = useRouter();

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
      else setEmail(user.email || "");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    });

    const data = await res.json();
    if (res.ok) {
      router.push("/admin/retention");
      router.refresh();
    } else {
      setError(data.error || "Invalid access code");
      setLoading(false);
    }
  }

  const isAppleRelay = email.includes("privaterelay.appleid.com");
  const displayEmail = isAppleRelay ? "your Apple ID" : email;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rumi_logo.png" alt="Rumi" className="h-10 w-auto mb-4" />
        <h1 className="text-white text-lg font-semibold mb-1">Access Required</h1>
        {email && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm">
              Signed in with{" "}
              <span className="text-yellow-400">{displayEmail}</span>
            </p>
            <button
              onClick={handleSignOut}
              className="text-gray-500 text-xs hover:text-gray-300 transition-colors ml-3 shrink-0"
            >
              Sign out
            </button>
          </div>
        )}
        <p className="text-gray-400 text-sm mb-6">
          Enter your access code to continue to the dashboard.
        </p>
        {error && (
          <div className="bg-red-400/10 border border-red-400/20 rounded p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Enter access code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-white text-sm focus:outline-none focus:border-yellow-400 tracking-widest font-mono uppercase"
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full bg-yellow-400 text-black rounded py-2 text-sm font-medium hover:bg-yellow-300 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Continue →"}
          </button>
        </form>
        <p className="text-gray-600 text-xs mt-6 text-center">
          Need access?{" "}
          <a href="mailto:support@rumi.team" className="text-gray-500 hover:text-yellow-400 transition-colors">
            Contact support@rumi.team
          </a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
