"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { FlaskConical, CheckCircle, XCircle, ShieldCheck } from "lucide-react";
import { KPICard } from "@/components/charts/kpi-card";
import type { ExperimentResult, GuardrailMetric } from "@/lib/retention/types";

interface ExperimentsData {
  experiments: ExperimentResult[];
  exploration_trend: Array<{ date: string; rate: number }>;
}

export default function ExperimentsDashboard() {
  const [data, setData] = useState<ExperimentsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention/experiments")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading experiment data...</div>;
  if (!data) return <div className="p-8 text-gray-400">Failed to load experiment data.</div>;

  const totalExperiments = data.experiments.length;
  const significantCount = data.experiments.filter((e) => e.is_significant).length;
  const totalUsers = data.experiments.reduce((s, e) => s + e.control_count + e.treatment_count, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
        <FlaskConical className="h-6 w-6" />
        Experiments
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Active Experiments" value={totalExperiments} color="yellow" />
        <KPICard label="Statistically Significant" value={significantCount} color="green" />
        <KPICard label="Total Users in Experiments" value={totalUsers} color="blue" />
        <KPICard
          label="Latest Exploration Rate"
          value={data.exploration_trend.length > 0 ? `${data.exploration_trend[data.exploration_trend.length - 1].rate}%` : "—"}
          color="yellow"
        />
      </div>

      {/* Per-Experiment Cards */}
      {data.experiments.map((exp) => (
        <div key={exp.flag_id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200 font-mono">{exp.flag_id}</h2>
            {exp.is_significant ? (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-900 text-green-300">
                <CheckCircle className="h-3 w-3" /> Significant
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">
                <XCircle className="h-3 w-3" /> Not Significant
              </span>
            )}
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs">
                  <th className="text-left p-2"></th>
                  <th className="text-center p-2">Control</th>
                  <th className="text-center p-2">Treatment</th>
                  <th className="text-center p-2">Lift</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="p-2 text-xs text-gray-400">Users</td>
                  <td className="p-2 text-center font-mono text-xs">{exp.control_count}</td>
                  <td className="p-2 text-center font-mono text-xs">{exp.treatment_count}</td>
                  <td className="p-2 text-center text-xs text-gray-500">—</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="p-2 text-xs text-gray-400">Retention Rate</td>
                  <td className="p-2 text-center font-mono text-xs">{(exp.control_retention_rate * 100).toFixed(1)}%</td>
                  <td className="p-2 text-center font-mono text-xs">{(exp.treatment_retention_rate * 100).toFixed(1)}%</td>
                  <td className="p-2 text-center">
                    <span className={`text-xs font-mono ${exp.lift >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {exp.lift >= 0 ? "+" : ""}{(exp.lift * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
                {/* Guardrails */}
                {exp.guardrails.map((g: GuardrailMetric) => (
                  <tr key={g.metric_name} className="border-b border-gray-800">
                    <td className="p-2 text-xs text-gray-400 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-gray-500" />
                      {g.metric_name}
                    </td>
                    <td className="p-2 text-center font-mono text-xs">{g.control_value}</td>
                    <td className="p-2 text-center font-mono text-xs">{g.treatment_value}</td>
                    <td className="p-2 text-center">
                      {g.degraded ? (
                        <span className="text-xs text-red-400">Degraded</span>
                      ) : (
                        <span className="text-xs text-green-400">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            Confidence: {(exp.confidence * 100).toFixed(1)}% (z-test, 95% threshold)
          </p>
        </div>
      ))}

      {data.experiments.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-500">No experiments found. Assign users to feature flags to start.</p>
        </div>
      )}

      {/* Exploration Rate Trend */}
      {data.exploration_trend.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">
            RL Policy Convergence — Exploration Rate Over Time
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.exploration_trend.map((d) => ({ ...d, date: d.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} unit="%" />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Area type="monotone" dataKey="rate" stroke="#a855f7" fill="#a855f733" name="Exploration %" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2">
            A declining exploration rate indicates the Thompson Sampling policy is converging on optimal actions.
          </p>
        </div>
      )}
    </div>
  );
}
