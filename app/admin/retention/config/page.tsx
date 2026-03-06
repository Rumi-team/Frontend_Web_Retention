"use client";

import { useEffect, useState } from "react";
import type { PolicyConfig } from "@/lib/retention/types";

export default function PolicyConfigPage() {
  const [configs, setConfigs] = useState<PolicyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formVersion, setFormVersion] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formJson, setFormJson] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadConfigs();
  }, []);

  function loadConfigs() {
    fetch("/api/admin/retention/config")
      .then((r) => r.json())
      .then((data) => {
        setConfigs(data.configs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  function startEdit() {
    const active = configs.find((c) => c.is_active);
    if (active) {
      const vParts = active.version.split(".");
      const minor = parseInt(vParts[vParts.length - 1] || "0") + 1;
      vParts[vParts.length - 1] = String(minor);
      setFormVersion(vParts.join("."));
      setFormJson(JSON.stringify(active.config_json, null, 2));
    } else {
      setFormVersion("v1.1");
      setFormJson("{}");
    }
    setFormNotes("");
    setError("");
    setEditing(true);
  }

  async function publish() {
    setError("");
    try {
      const parsed = JSON.parse(formJson);
      setPublishing(true);
      const resp = await fetch("/api/admin/retention/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: formVersion,
          config_json: parsed,
          notes: formNotes,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        setError(data.error || "Failed to publish");
        setPublishing(false);
        return;
      }
      setEditing(false);
      setPublishing(false);
      loadConfigs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      setPublishing(false);
    }
  }

  if (loading)
    return <div className="p-8 text-gray-400">Loading config...</div>;

  const active = configs.find((c) => c.is_active);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-yellow-400">Policy Config</h1>
        {!editing && (
          <button
            onClick={startEdit}
            className="px-4 py-2 bg-yellow-400 text-black rounded text-sm font-medium hover:bg-yellow-300"
          >
            New Version
          </button>
        )}
      </div>

      {/* Active config summary */}
      {active && !editing && (
        <div className="bg-gray-900 border border-yellow-400/30 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="text-sm font-bold">{active.version}</span>
              <span className="ml-2 px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded">
                active
              </span>
            </div>
            <span className="text-xs text-gray-400">
              Published {new Date(active.published_at).toLocaleString()} by{" "}
              {active.published_by}
            </span>
          </div>
          <pre className="text-xs bg-black p-3 rounded overflow-auto max-h-80 text-gray-300">
            {JSON.stringify(active.config_json, null, 2)}
          </pre>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Version</label>
              <input
                value={formVersion}
                onChange={(e) => setFormVersion(e.target.value)}
                className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm w-32"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="bg-black border border-gray-700 rounded px-3 py-1.5 text-sm w-full"
                placeholder="What changed?"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Config JSON
            </label>
            <textarea
              value={formJson}
              onChange={(e) => setFormJson(e.target.value)}
              rows={20}
              className="bg-black border border-gray-700 rounded px-3 py-2 text-xs font-mono w-full"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={publish}
              disabled={publishing}
              className="px-4 py-2 bg-yellow-400 text-black rounded text-sm font-medium hover:bg-yellow-300 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Version history */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">
          Version History
        </h2>
        <div className="space-y-2">
          {configs.map((c) => (
            <div
              key={c.version}
              className="flex items-center gap-3 text-xs border-b border-gray-800 py-2"
            >
              <span className="font-mono font-bold w-16">{c.version}</span>
              {c.is_active && (
                <span className="px-1.5 py-0.5 bg-green-900 text-green-300 rounded">
                  active
                </span>
              )}
              <span className="text-gray-400">
                {new Date(c.published_at).toLocaleString()}
              </span>
              <span className="text-gray-400">by {c.published_by}</span>
              {c.notes && (
                <span className="text-gray-500 flex-1 truncate">
                  — {c.notes}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
