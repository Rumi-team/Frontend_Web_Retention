"use client";

import { useEffect, useState } from "react";
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
import { Activity, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/charts/kpi-card";
import type { DAUMAURatio, SessionMetric, StickinessPoint } from "@/lib/retention/types";

interface EngagementData {
  dau_mau: DAUMAURatio[];
  session_metrics: SessionMetric[];
  stickiness: StickinessPoint[];
  duration_alert: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function getRatioBenchmark(ratio: number): { label: string; color: string } {
  if (ratio >= 0.2) return { label: "Healthy", color: "text-green-400" };
  if (ratio >= 0.1) return { label: "Warning", color: "text-yellow-400" };
  return { label: "Critical", color: "text-red-400" };
}

export default function EngagementDashboard() {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention/engagement")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading engagement data...</div>;
  if (!data) return <div className="p-8 text-gray-400">Failed to load engagement data.</div>;

  const latestDAU = data.dau_mau[data.dau_mau.length - 1];
  const currentRatio = latestDAU?.ratio || 0;
  const benchmark = getRatioBenchmark(currentRatio);

  const latestSession = data.session_metrics[data.session_metrics.length - 1];
  const avgDuration = latestSession?.avg_duration_seconds || 0;
  const totalDailySessions = latestSession?.total_sessions || 0;

  // Stickiness stats
  const totalStickyUsers = data.stickiness.reduce((s, p) => s + p.user_count, 0);
  const weightedDays = data.stickiness.reduce((s, p) => s + p.days_active * p.user_count, 0);
  const avgStickiness = totalStickyUsers > 0 ? (weightedDays / totalStickyUsers).toFixed(1) : "0";

  const dauMauChart = data.dau_mau.map((d) => ({
    date: d.date.slice(5),
    ratio: Math.round(d.ratio * 100),
    dau: d.dau,
  }));

  const sessionChart = data.session_metrics.map((m) => ({
    date: m.date.slice(5),
    duration: Math.round(m.avg_duration_seconds / 60),
    sessions: m.total_sessions,
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
        <Activity className="h-6 w-6" />
        Engagement Metrics
      </h1>

      {/* ── DAU/MAU Ratio ── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">DAU / MAU Ratio</h2>
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="DAU/MAU Ratio" value={`${(currentRatio * 100).toFixed(1)}%`} color="yellow" />
          <KPICard label="DAU (today)" value={latestDAU?.dau || 0} color="blue" />
          <KPICard label="MAU (30d)" value={latestDAU?.mau || 0} color="blue" />
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400">Benchmark</p>
            <p className={`text-2xl font-bold mt-1 ${benchmark.color}`}>{benchmark.label}</p>
            <p className="text-xs text-gray-500 mt-1">
              {currentRatio >= 0.2 ? ">20% = healthy" : currentRatio >= 0.1 ? "10-20% = warning" : "<10% = critical"}
            </p>
          </div>
        </div>

        {dauMauChart.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-4 text-gray-300">DAU/MAU Ratio Trend (30d)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={dauMauChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#666" fontSize={10} />
                <YAxis stroke="#666" fontSize={10} unit="%" />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                <Area type="monotone" dataKey="ratio" stroke="#eab308" fill="#eab30833" name="DAU/MAU %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Session Duration ── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Session Duration</h2>

        {data.duration_alert && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">
              Average session duration dropped more than 20% in the last 3 days.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <KPICard label="Avg Session" value={formatDuration(avgDuration)} color={data.duration_alert ? "red" : "green"} />
          <KPICard label="Sessions Today" value={totalDailySessions} color="blue" />
          <KPICard label="Unique Users Today" value={latestSession?.unique_users || 0} color="blue" />
        </div>

        {sessionChart.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-4 text-gray-300">Avg Duration (min) & Sessions (30d)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={sessionChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#666" fontSize={10} />
                <YAxis yAxisId="left" stroke="#666" fontSize={10} />
                <YAxis yAxisId="right" orientation="right" stroke="#666" fontSize={10} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                <Area yAxisId="left" type="monotone" dataKey="duration" stroke="#22c55e" fill="#22c55e33" name="Avg Duration (min)" />
                <Area yAxisId="right" type="monotone" dataKey="sessions" stroke="#3b82f6" fill="#3b82f633" name="Total Sessions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Stickiness ── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Stickiness Distribution</h2>
        <div className="grid grid-cols-3 gap-4">
          <KPICard label="Avg Days Active / Month" value={avgStickiness} color="yellow" />
          <KPICard label="Total Tracked Users" value={totalStickyUsers} color="blue" />
          <KPICard
            label="Power Users (10+ days)"
            value={data.stickiness.filter((p) => p.days_active >= 10).reduce((s, p) => s + p.user_count, 0)}
            color="green"
          />
        </div>

        {data.stickiness.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-4 text-gray-300">Days Active per Month vs User Count</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.stickiness}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="days_active" stroke="#666" fontSize={10} label={{ value: "Days Active", position: "insideBottom", offset: -2, style: { fill: "#666", fontSize: 10 } }} />
                <YAxis stroke="#666" fontSize={10} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                <Bar dataKey="user_count" fill="#eab308" name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
