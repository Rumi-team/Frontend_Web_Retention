"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { KPICard } from "@/components/charts/kpi-card";
import { Heatmap } from "@/components/charts/heatmap";
import type { LifecycleDay, CohortRow, RetentionMode } from "@/lib/retention/types";

interface LifecycleData {
  daily: LifecycleDay[];
  current: { new: number; returning: number; resurrecting: number; dormant: number };
  rl_interventions: Record<string, number>;
}

interface CohortData {
  cohorts: CohortRow[];
  period_unit: string;
}

const RANGES = [
  { label: "7d", value: "7" },
  { label: "14d", value: "14" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
];

const MODES: { label: string; value: RetentionMode }[] = [
  { label: "First-time", value: "first_time" },
  { label: "Recurring", value: "recurring" },
  { label: "Unbounded", value: "unbounded" },
];

export default function LifecycleDashboard() {
  const [lifecycle, setLifecycle] = useState<LifecycleData | null>(null);
  const [cohorts, setCohorts] = useState<CohortData | null>(null);
  const [range, setRange] = useState("30");
  const [cohortUnit, setCohortUnit] = useState<"week" | "month">("week");
  const [cohortMode, setCohortMode] = useState<RetentionMode>("first_time");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/retention/lifecycle?range=${range}`)
      .then((r) => r.json())
      .then((d) => { setLifecycle(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    fetch(`/api/admin/retention/cohorts?unit=${cohortUnit}&mode=${cohortMode}`)
      .then((r) => r.json())
      .then((d) => setCohorts(d))
      .catch(() => {});
  }, [cohortUnit, cohortMode]);

  if (loading) return <div className="p-8 text-gray-400">Loading lifecycle data...</div>;
  if (!lifecycle) return <div className="p-8 text-gray-400">Failed to load lifecycle data.</div>;

  const chartData = lifecycle.daily.map((d) => ({
    date: d.date.slice(5),
    New: d.new,
    Returning: d.returning,
    Resurrecting: d.resurrecting,
    Dormant: d.dormant,
  }));

  // Build heatmap from cohorts
  const maxPeriod = cohorts?.cohorts.reduce((max, r) => Math.max(max, r.periods.length), 0) || 0;
  const cohortHeaders = Array.from({ length: maxPeriod }, (_, i) =>
    `${cohortUnit === "week" ? "Wk" : "Mo"} ${i}`
  );
  const heatmapRows = (cohorts?.cohorts || []).map((row) => ({
    label: row.cohort_label,
    sublabel: `n=${row.cohort_size}`,
    cells: row.periods.map((p) => ({ value: p.rate })),
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
          <RefreshCw className="h-6 w-6" />
          Lifecycle & Cohort Analysis
        </h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                range === r.value
                  ? "bg-yellow-400 text-black font-semibold"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lifecycle KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="New" value={lifecycle.current.new} color="green" />
        <KPICard label="Returning" value={lifecycle.current.returning} color="blue" />
        <KPICard label="Resurrecting" value={lifecycle.current.resurrecting} color="yellow" />
        <KPICard label="Dormant" value={lifecycle.current.dormant} color="red" />
      </div>

      {/* Lifecycle Stacked Bar Chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">Lifecycle Composition</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Returning" stackId="lifecycle" fill="#3b82f6" />
              <Bar dataKey="New" stackId="lifecycle" fill="#22c55e" />
              <Bar dataKey="Resurrecting" stackId="lifecycle" fill="#a855f7" />
              <Bar dataKey="Dormant" stackId="lifecycle" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* RL Agent Activity Overlay */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">
          RL Agent Interventions by Lifecycle Stage (7d)
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {(["new", "returning", "resurrecting", "dormant"] as const).map((stage) => {
            const count = lifecycle.rl_interventions[stage] || 0;
            const colors = {
              new: "border-green-800 text-green-400",
              returning: "border-blue-800 text-blue-400",
              resurrecting: "border-purple-800 text-purple-400",
              dormant: "border-red-800 text-red-400",
            };
            return (
              <div key={stage} className={`border rounded-lg p-3 ${colors[stage]}`}>
                <p className="text-xs text-gray-400 capitalize">{stage}</p>
                <p className="text-lg font-bold">{count} interventions</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cohort Retention Matrix */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-300">Cohort Retention Matrix</h2>
          <div className="flex gap-2">
            <div className="flex gap-1">
              {(["week", "month"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setCohortUnit(u)}
                  className={`px-2 py-1 text-xs rounded ${
                    cohortUnit === u ? "bg-yellow-400 text-black font-semibold" : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {u === "week" ? "Weekly" : "Monthly"}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setCohortMode(m.value)}
                  className={`px-2 py-1 text-xs rounded ${
                    cohortMode === m.value ? "bg-yellow-400 text-black font-semibold" : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {heatmapRows.length > 0 ? (
          <Heatmap rows={heatmapRows} columnHeaders={cohortHeaders} />
        ) : (
          <p className="text-sm text-gray-500">No cohort data yet. Run the daily-metrics cron to populate.</p>
        )}
      </div>
    </div>
  );
}
