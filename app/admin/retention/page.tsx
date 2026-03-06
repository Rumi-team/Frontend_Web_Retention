"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { RetentionMetrics, RecentDecision } from "@/lib/retention/types";

export default function RetentionDashboard() {
  const [metrics, setMetrics] = useState<RetentionMetrics | null>(null);
  const [decisions, setDecisions] = useState<RecentDecision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention")
      .then((r) => r.json())
      .then((data) => {
        setMetrics(data.metrics);
        setDecisions(data.recent_decisions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="p-8 text-gray-400">Loading retention data...</div>
    );

  const timeSeries = metrics?.time_series;
  const tsData = timeSeries
    ? Object.keys(timeSeries.decisions_by_day)
        .sort()
        .map((day) => ({
          day: day.slice(5), // MM-DD
          decisions: timeSeries.decisions_by_day[day] || 0,
          rewards: timeSeries.rewards_by_day[day] || 0,
        }))
    : [];

  const dimDist = metrics?.dimension_distributions || {};

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-yellow-400">
          Retention Dashboard
        </h1>
        <div className="flex gap-2 text-sm text-gray-400">
          <span className="px-2 py-1 bg-gray-800 rounded">
            {metrics?.rl_health ? "Thompson Sampling" : "Epsilon-Greedy"}
          </span>
          <span className="px-2 py-1 bg-gray-800 rounded">30d</span>
        </div>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Decisions", value: metrics.total_decisions },
            { label: "Total Events", value: metrics.total_events },
            {
              label: "Avg Reward",
              value: metrics.avg_reward?.toFixed(3) || "0",
            },
            {
              label: "Exploration Rate",
              value: `${((metrics.exploration_rate || 0) * 100).toFixed(1)}%`,
            },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* RL Health */}
      {metrics?.rl_health && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400">Incremental Lift</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.rl_health.avg_incremental_lift?.toFixed(3) || "—"}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400">Cold Start Users</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.rl_health.cold_start_count}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400">Total Rewards</p>
            <p className="text-2xl font-bold mt-1">{metrics.total_rewards}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400">A/B Split</p>
            <div className="flex gap-2 mt-1 text-sm">
              <span>C: {metrics.ab_split?.control || 0}</span>
              <span>T: {metrics.ab_split?.treatment || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Time Series */}
      {tsData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">
            Decisions & Rewards (30d)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={tsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="day" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
              />
              <Area
                type="monotone"
                dataKey="decisions"
                stroke="#eab308"
                fill="#eab30833"
                name="Decisions"
              />
              <Area
                type="monotone"
                dataKey="rewards"
                stroke="#22c55e"
                fill="#22c55e33"
                name="Rewards"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dimension Distribution */}
      {Object.keys(dimDist).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">
            Dimension Distributions
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(dimDist).map(([dim, opts]) => {
              const data = Object.entries(opts).map(([opt, count]) => ({
                name: opt,
                count,
              }));
              return (
                <div key={dim}>
                  <p className="text-xs text-gray-400 mb-2 capitalize">{dim}</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={data}>
                      <XAxis dataKey="name" stroke="#666" fontSize={9} />
                      <YAxis stroke="#666" fontSize={9} />
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a1a",
                          border: "1px solid #333",
                        }}
                      />
                      <Bar dataKey="count" fill="#eab308" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Distribution */}
      {metrics?.action_distribution && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-300">
            Action Distribution
          </h2>
          <div className="space-y-2">
            {Object.entries(metrics.action_distribution)
              .sort(([, a], [, b]) => b - a)
              .map(([action, count]) => {
                const total = metrics.total_decisions || 1;
                const pct = ((count / total) * 100).toFixed(1);
                return (
                  <div key={action} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-48 truncate text-gray-300">
                      {action}
                    </span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Recent Decisions */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">
          Recent Decisions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs">
                <th className="text-left p-2">User</th>
                <th className="text-left p-2">Action</th>
                <th className="text-left p-2">Explore</th>
                <th className="text-left p-2">Version</th>
                <th className="text-left p-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50"
                >
                  <td className="p-2 font-mono text-xs">
                    <Link
                      href={`/admin/retention/users/${d.provider_user_id}`}
                      className="text-yellow-400 hover:underline"
                    >
                      {d.provider_user_id.slice(0, 12)}...
                    </Link>
                  </td>
                  <td className="p-2 text-xs font-mono">{d.action_chosen}</td>
                  <td className="p-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        d.was_exploration
                          ? "bg-blue-900 text-blue-300"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {d.was_exploration ? "yes" : "no"}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-gray-400">
                    {d.policy_version}
                  </td>
                  <td className="p-2 text-xs text-gray-400">
                    {new Date(d.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
