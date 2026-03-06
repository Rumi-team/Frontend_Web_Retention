"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { UserRetentionDetail, PosteriorEntry } from "@/lib/retention/types";

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const [data, setData] = useState<UserRetentionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/retention/users/${userId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  if (loading)
    return <div className="p-8 text-gray-400">Loading user data...</div>;
  if (!data)
    return <div className="p-8 text-gray-400">User not found.</div>;

  // Group posteriors by dimension
  const dimPosteriors: Record<string, Array<{ option: string; alpha: number; beta: number; mean: number }>> = {};
  for (const [key, val] of Object.entries(data.posteriors as Record<string, PosteriorEntry>)) {
    const [dim, opt] = key.split(":");
    if (!dimPosteriors[dim]) dimPosteriors[dim] = [];
    const mean = val.alpha / (val.alpha + val.beta);
    dimPosteriors[dim].push({ option: opt, alpha: val.alpha, beta: val.beta, mean });
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-yellow-400">User Detail</h1>
        <p className="text-xs font-mono text-gray-400 mt-1">{data.user_id}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400">Segment</p>
          <p className="text-lg font-bold mt-1 capitalize">
            {data.segment.replace(/_/g, " ")}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400">Decisions</p>
          <p className="text-lg font-bold mt-1">{data.decision_count}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400">Last Contact</p>
          <p className="text-lg font-bold mt-1">
            {data.last_contact
              ? new Date(data.last_contact).toLocaleDateString()
              : "—"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400">Events Tracked</p>
          <p className="text-lg font-bold mt-1">
            {data.recent_events?.length || 0}
          </p>
        </div>
      </div>

      {/* Posteriors by dimension */}
      {Object.keys(dimPosteriors).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">
            Beta Posteriors (mean = α / (α+β))
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(dimPosteriors).map(([dim, entries]) => {
              const sorted = [...entries].sort((a, b) => b.mean - a.mean);
              const chartData = sorted.map((e) => ({
                name: e.option,
                mean: parseFloat(e.mean.toFixed(3)),
                alpha: e.alpha,
                beta: e.beta,
              }));
              return (
                <div key={dim}>
                  <p className="text-xs text-gray-400 mb-2 capitalize">{dim}</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" stroke="#666" fontSize={9} />
                      <YAxis stroke="#666" fontSize={9} domain={[0, 1]} />
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a1a",
                          border: "1px solid #333",
                        }}
                        formatter={(value: number, name: string) => [
                          value.toFixed(3),
                          name,
                        ]}
                      />
                      <Bar dataKey="mean" fill="#eab308" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Decision timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">
          Decision Timeline (Last 20)
        </h2>
        <div className="space-y-2">
          {data.recent_decisions.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 text-xs border-b border-gray-800 py-2"
            >
              <span className="text-gray-400 w-32">
                {new Date(d.created_at).toLocaleString()}
              </span>
              <span className="font-mono text-gray-300 flex-1">
                {d.action_chosen}
              </span>
              <span className="text-gray-400">{d.policy_version}</span>
              {d.was_exploration && (
                <span className="px-1.5 py-0.5 bg-blue-900 text-blue-300 rounded text-xs">
                  explore
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Event history */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">
          Event History (Last 50)
        </h2>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {data.recent_events.map((e, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-xs py-1"
            >
              <span className="text-gray-400 w-32">
                {new Date(e.timestamp).toLocaleString()}
              </span>
              <span className="font-mono text-yellow-400">{e.event_type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
