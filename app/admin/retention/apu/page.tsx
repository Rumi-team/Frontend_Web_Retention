"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Crown, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/charts/kpi-card";
import type { APUSnapshot, APUUser } from "@/lib/retention/types";

interface APUData {
  snapshots: APUSnapshot[];
  apu_users: APUUser[];
  current_apu_count: number;
  apu_ratio: number;
  total_paying: number;
  trend: number;
  alerts: Array<{ user_id: string; previous_sessions: number; current_sessions: number }>;
}

export default function APUDashboard() {
  const [data, setData] = useState<APUData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention/apu")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading APU data...</div>;
  if (!data) return <div className="p-8 text-gray-400">Failed to load APU data.</div>;

  const chartData = data.snapshots.map((s) => ({
    date: s.date.slice(5),
    apu: s.apu_count,
    paying: s.total_paying,
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
          <Crown className="h-6 w-6" />
          APU / VIP Dashboard
        </h1>
        <span className="text-xs text-gray-500">
          APU = Paying users with 4+ sessions/week
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Active Paying Power Users"
          value={data.current_apu_count}
          trend={data.trend}
          trendLabel="vs 48h ago"
          color="yellow"
          icon={Crown}
        />
        <KPICard
          label="APU Ratio"
          value={`${(data.apu_ratio * 100).toFixed(1)}%`}
          color="green"
        />
        <KPICard
          label="Total Paying Users"
          value={data.total_paying}
          color="blue"
        />
        <KPICard
          label="APU Health Alerts"
          value={data.alerts.length}
          color={data.alerts.length > 0 ? "red" : "green"}
          icon={AlertTriangle}
        />
      </div>

      {/* APU Trend Chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">
            APU Count (30d)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Area
                type="monotone"
                dataKey="apu"
                stroke="#eab308"
                fill="#eab30833"
                name="APU"
              />
              <Area
                type="monotone"
                dataKey="paying"
                stroke="#3b82f6"
                fill="#3b82f633"
                name="Total Paying"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* APU User Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">
          Current APU Users — Contact List for Founder Calls
        </h2>
        {data.apu_users.length === 0 ? (
          <p className="text-sm text-gray-500">No APU users yet. Users need 4+ sessions/week and a paid plan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs">
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Sessions / Week</th>
                  <th className="text-left p-2">Last Session</th>
                </tr>
              </thead>
              <tbody>
                {data.apu_users.map((u) => (
                  <tr key={u.user_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-2 font-mono text-xs">
                      <Link
                        href={`/admin/retention/users/${u.user_id}`}
                        className="text-yellow-400 hover:underline"
                      >
                        {u.user_id.slice(0, 12)}...
                      </Link>
                    </td>
                    <td className="p-2 text-xs text-gray-300">{u.email || "—"}</td>
                    <td className="p-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-green-900 text-green-300 font-mono">
                        {u.sessions_this_week}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-gray-400">{u.last_session}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Health Alerts */}
      {data.alerts.length > 0 && (
        <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            APU Health Alerts — Users Who Dropped Below 4 Sessions/Week
          </h2>
          <div className="space-y-2">
            {data.alerts.map((a) => (
              <div key={a.user_id} className="flex items-center gap-3 text-sm">
                <Link
                  href={`/admin/retention/users/${a.user_id}`}
                  className="text-yellow-400 hover:underline font-mono text-xs"
                >
                  {a.user_id.slice(0, 12)}...
                </Link>
                <span className="text-gray-400">
                  dropped from {a.previous_sessions} → {a.current_sessions} sessions/week
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
