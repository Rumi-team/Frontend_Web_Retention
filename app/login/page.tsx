"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    if (resp.ok) {
      router.push("/admin/retention");
    } else {
      setError("Invalid password");
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-yellow-400 mb-6">Retention Dashboard</h1>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin password"
            className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-yellow-400 text-black rounded py-2 text-sm font-medium hover:bg-yellow-300"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
