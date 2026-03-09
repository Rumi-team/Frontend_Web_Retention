"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, BrainCircuit } from "lucide-react";
import { KPICard } from "@/components/charts/kpi-card";
import type { CorrelationResult } from "@/lib/retention/types";

interface ChurnData {
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  total: number;
  risk_distribution: Array<{ bucket: string; count: number }>;
  at_risk_users: Array<{
    user_id: string;
    score: number;
    top_factor: string;
    last_session: string | null;
    rl_intervention: string | null;
  }>;
  correlations: CorrelationResult[];
}

const FACTOR_LABELS: Record<string, string> = {
  days_since_last: "No recent session",
  frequency_trend: "Frequency declining",
  duration_trend: "Duration declining",
  engagement_breadth: "Low engagement breadth",
  account_age_risk: "New account risk",
};

function scoreColor(score: number): string {
  if (score >= 0.7) return "bg-red-900 text-red-300";
  if (score >= 0.4) return "bg-yellow-900 text-yellow-300";
  return "bg-green-900 text-green-300";
}

export default function ChurnDashboard() {
  const [data, setData] = useState<ChurnData | null>(null);
  const [tab, setTab] = useState<"risk" | "correlations">("risk");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention/churn")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading churn data...</div>;
  if (!data) return <div className="p-8 text-gray-400">Failed to load churn data.</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6" />
          Churn Risk
        </h1>
        <div className="flex gap-1">
          <button
            onClick={() => setTab("risk")}
            className={`px-3 py-1 text-xs rounded ${tab === "risk" ? "bg-yellow-400 text-black font-semibold" : "bg-gray-800 text-gray-400"}`}
          >
            Risk Scores
          </button>
          <button
            onClick={() => setTab("correlations")}
            className={`px-3 py-1 text-xs rounded ${tab === "correlations" ? "bg-yellow-400 text-black font-semibold" : "bg-gray-800 text-gray-400"}`}
          >
            Correlations
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="High Risk (>0.7)" value={data.high_risk} color="red" icon={AlertTriangle} />
        <KPICard label="Medium Risk (0.4-0.7)" value={data.medium_risk} color="yellow" />
        <KPICard label="Low Risk (<0.4)" value={data.low_risk} color="green" />
        <KPICard label="Total Scored" value={data.total} color="blue" />
      </div>

      {tab === "risk" && (
        <>
          {/* Risk Distribution */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-4 text-gray-300">Risk Score Distribution</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.risk_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="bucket" stroke="#666" fontSize={10} />
                <YAxis stroke="#666" fontSize={10} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                <Bar dataKey="count" fill="#ef4444" name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* At-Risk Users Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3 text-gray-300">At-Risk Users</h2>
            {data.at_risk_users.length === 0 ? (
              <p className="text-sm text-gray-500">No at-risk users detected.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400 text-xs">
                      <th className="text-left p-2">User</th>
                      <th className="text-left p-2">Score</th>
                      <th className="text-left p-2">Top Factor</th>
                      <th className="text-left p-2">Last Session</th>
                      <th className="text-left p-2">RL Intervention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.at_risk_users.map((u) => (
                      <tr key={u.user_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="p-2 font-mono text-xs">
                          <Link href={`/admin/retention/users/${u.user_id}`} className="text-yellow-400 hover:underline">
                            {u.user_id.slice(0, 12)}...
                          </Link>
                        </td>
                        <td className="p-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-mono ${scoreColor(u.score)}`}>
                            {u.score.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-2 text-xs text-gray-300">
                          {FACTOR_LABELS[u.top_factor] || u.top_factor}
                        </td>
                        <td className="p-2 text-xs text-gray-400">{u.last_session || "Never"}</td>
                        <td className="p-2">
                          {u.rl_intervention ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300">
                              {u.rl_intervention}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">none</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "correlations" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-gray-300">Retention Correlations</h2>
            <span className="text-xs text-gray-500">PostHog-style correlation analysis → RL feature engineering</span>
          </div>

          {data.correlations.length === 0 ? (
            <p className="text-sm text-gray-500">
              No correlations computed yet. Run the daily-metrics cron to populate.
            </p>
          ) : (
            <>
              {/* Success correlations */}
              <div>
                <h3 className="text-xs text-green-400 font-semibold mb-2">Predicts Retention (OR &gt; 1)</h3>
                <div className="space-y-1">
                  {data.correlations
                    .filter((c) => c.correlation_type === "success")
                    .map((c) => (
                      <div key={`${c.property_name}-${c.property_value}`} className="flex items-center gap-3 text-sm">
                        <span className="text-gray-300 font-mono text-xs w-64 truncate">
                          {c.property_name} = {c.property_value}
                        </span>
                        <span className="text-green-400 text-xs font-mono w-20">
                          OR: {c.odds_ratio.toFixed(1)}x
                        </span>
                        <span className="text-gray-500 text-xs w-16">
                          p={c.significance.toFixed(3)}
                        </span>
                        {c.rl_feature_candidate && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">RL</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Failure correlations */}
              <div>
                <h3 className="text-xs text-red-400 font-semibold mb-2">Predicts Churn (OR &lt; 1)</h3>
                <div className="space-y-1">
                  {data.correlations
                    .filter((c) => c.correlation_type === "failure")
                    .map((c) => (
                      <div key={`${c.property_name}-${c.property_value}`} className="flex items-center gap-3 text-sm">
                        <span className="text-gray-300 font-mono text-xs w-64 truncate">
                          {c.property_name} = {c.property_value}
                        </span>
                        <span className="text-red-400 text-xs font-mono w-20">
                          OR: {c.odds_ratio.toFixed(1)}x
                        </span>
                        <span className="text-gray-500 text-xs w-16">
                          p={c.significance.toFixed(3)}
                        </span>
                        {c.rl_feature_candidate && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">RL</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
