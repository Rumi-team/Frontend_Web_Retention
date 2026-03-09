"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Link2, ArrowUpRight, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/charts/kpi-card";

interface StrategyRetention {
  strategy: string;
  total_sessions: number;
  returned_within_48h: number;
  returned_within_7d: number;
  avg_transformation: number;
  retention_rate_48h: number;
  retention_rate_7d: number;
}

interface TransformationRetention {
  level: number;
  session_count: number;
  returned_within_48h: number;
  retention_rate_48h: number;
}

interface CoachingData {
  connected: boolean;
  has_data?: boolean;
  message?: string;
  summary?: {
    total_coaching_sessions: number;
    unique_coached_users: number;
    paying_users: number;
    total_retention_decisions: number;
    users_with_both: number;
  };
  strategy_retention?: StrategyRetention[];
  transformation_retention?: TransformationRetention[];
  intervention_distribution?: Record<string, number>;
  session_trend?: Array<{ date: string; sessions: number }>;
}

const COLORS = ["#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6", "#f97316"];

export default function CoachingConnectionPage() {
  const [data, setData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention/coaching")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading coaching data...</div>;

  if (!data?.connected) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2 mb-6">
          <Link2 className="h-6 w-6" />
          Coaching Connection
        </h1>
        <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <h2 className="text-sm font-semibold text-yellow-400">Cross-Project Not Configured</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">{data?.message}</p>
          <div className="bg-gray-900 rounded p-3 font-mono text-xs text-gray-300">
            <p>RUMI_APP_SUPABASE_URL=https://xdaxseboeioleiguqfkg.supabase.co</p>
            <p>RUMI_APP_SUPABASE_SERVICE_KEY=&lt;from Supabase dashboard&gt;</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.has_data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2 mb-6">
          <Link2 className="h-6 w-6" />
          Coaching Connection
        </h1>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-400">Connected to Rumi_App but no coaching sessions found yet.</p>
        </div>
      </div>
    );
  }

  const { summary, strategy_retention, transformation_retention, intervention_distribution, session_trend } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
          <Link2 className="h-6 w-6" />
          Coaching Connection
        </h1>
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-900 text-green-300">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Connected to Rumi_App
        </span>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          <KPICard label="Coaching Sessions" value={summary.total_coaching_sessions} color="yellow" />
          <KPICard label="Coached Users" value={summary.unique_coached_users} color="blue" />
          <KPICard label="Paying Users" value={summary.paying_users} color="green" />
          <KPICard label="RL Decisions" value={summary.total_retention_decisions} color="yellow" />
          <KPICard label="Users in Both" value={summary.users_with_both} color="blue" />
        </div>
      )}

      {/* Data Flow Diagram */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">Data Flow</h2>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-4">
          <div className="bg-gray-800 rounded px-3 py-2 text-center">
            <p className="text-yellow-400 font-semibold">Coaching App</p>
            <p>session_evaluations</p>
            <p>profiles</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowUpRight className="h-4 w-4 text-yellow-400" />
            <span className="text-[10px]">session_start</span>
          </div>
          <div className="bg-gray-800 rounded px-3 py-2 text-center">
            <p className="text-yellow-400 font-semibold">Retention Layer</p>
            <p>events, decisions</p>
            <p>rewards, flags</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowUpRight className="h-4 w-4 text-green-400" />
            <span className="text-[10px]">RL decision</span>
          </div>
          <div className="bg-gray-800 rounded px-3 py-2 text-center">
            <p className="text-yellow-400 font-semibold">Retention API</p>
            <p>contextual bandit</p>
            <p>Thompson sampling</p>
          </div>
        </div>
      </div>

      {/* Strategy → Retention Correlation */}
      {strategy_retention && strategy_retention.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">
            Coaching Strategy → Retention Rate
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Which coaching strategies lead to return visits? Higher 48h retention = strategy drives engagement.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs">
                  <th className="text-left p-2">Strategy</th>
                  <th className="text-center p-2">Sessions</th>
                  <th className="text-center p-2">Avg Transform</th>
                  <th className="text-center p-2">48h Return</th>
                  <th className="text-center p-2">7d Return</th>
                  <th className="text-left p-2">48h Rate</th>
                </tr>
              </thead>
              <tbody>
                {strategy_retention.map((s) => (
                  <tr key={s.strategy} className="border-b border-gray-800">
                    <td className="p-2 text-xs font-mono text-gray-300">{s.strategy}</td>
                    <td className="p-2 text-center text-xs">{s.total_sessions}</td>
                    <td className="p-2 text-center text-xs">
                      <span className={s.avg_transformation >= 3 ? "text-green-400" : s.avg_transformation >= 2 ? "text-yellow-400" : "text-red-400"}>
                        {s.avg_transformation || "—"}
                      </span>
                    </td>
                    <td className="p-2 text-center text-xs">{s.returned_within_48h}</td>
                    <td className="p-2 text-center text-xs">{s.returned_within_7d}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-800 rounded-full h-2 max-w-[100px]">
                          <div
                            className={`h-2 rounded-full ${s.retention_rate_48h >= 50 ? "bg-green-500" : s.retention_rate_48h >= 25 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(s.retention_rate_48h, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-12">{s.retention_rate_48h}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Transformation Level → Retention */}
        {transformation_retention && transformation_retention.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-4 text-gray-300">
              Transformation Level → 48h Return
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Higher coaching quality should predict higher retention.
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={transformation_retention}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="level" stroke="#666" fontSize={10} label={{ value: "Level", position: "insideBottom", offset: -2, fill: "#666", fontSize: 10 }} />
                <YAxis stroke="#666" fontSize={10} unit="%" />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
                  formatter={(value: number) => [`${value}%`, "48h Return Rate"]}
                />
                <Bar dataKey="retention_rate_48h" name="48h Return %">
                  {transformation_retention.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* RL Intervention Distribution */}
        {intervention_distribution && Object.keys(intervention_distribution).length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-4 text-gray-300">
              RL Interventions for Coached Users
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Actions the retention bandit chose for users who had coaching sessions.
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={Object.entries(intervention_distribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([action, count]) => ({ action, count }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#666" fontSize={10} />
                <YAxis dataKey="action" type="category" stroke="#666" fontSize={9} width={120} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                <Bar dataKey="count" fill="#eab308" name="Decisions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Session Trend */}
      {session_trend && session_trend.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">
            Coaching Sessions (30d)
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={session_trend.map((d) => ({ ...d, date: d.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Area type="monotone" dataKey="sessions" stroke="#eab308" fill="#eab30833" name="Coaching Sessions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cross-App Links */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">Quick Links</h2>
        <div className="grid grid-cols-3 gap-3">
          <a href="/admin/retention/churn" className="bg-gray-800 rounded p-3 hover:bg-gray-700 transition-colors">
            <p className="text-xs text-gray-400">Churn Risk</p>
            <p className="text-sm text-white mt-1">At-risk coached users</p>
          </a>
          <a href="/admin/retention/experiments" className="bg-gray-800 rounded p-3 hover:bg-gray-700 transition-colors">
            <p className="text-xs text-gray-400">Experiments</p>
            <p className="text-sm text-white mt-1">A/B test results</p>
          </a>
          <a href="/admin/retention/lifecycle" className="bg-gray-800 rounded p-3 hover:bg-gray-700 transition-colors">
            <p className="text-xs text-gray-400">Lifecycle</p>
            <p className="text-sm text-white mt-1">User state transitions</p>
          </a>
        </div>
      </div>
    </div>
  );
}
