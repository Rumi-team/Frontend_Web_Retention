"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "recharts";
import { ClipboardList } from "lucide-react";
import { KPICard } from "@/components/charts/kpi-card";
import type { ExitReasonSummary, ExitFormEntry } from "@/lib/retention/types";

interface ExitFormsData {
  total: number;
  last_7d: number;
  top_reason: string;
  reason_summary: ExitReasonSummary[];
  trend: Array<{ date: string; count: number }>;
  recent: ExitFormEntry[];
}

const REASON_LABELS: Record<string, string> = {
  too_expensive: "Too Expensive",
  not_useful: "Not Useful",
  found_alternative: "Found Alternative",
  too_complex: "Too Complex",
  missing_features: "Missing Features",
  bugs: "Bugs / Issues",
  other: "Other",
};

export default function ExitFormsDashboard() {
  const [data, setData] = useState<ExitFormsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention/exit-forms")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading exit form data...</div>;
  if (!data) return <div className="p-8 text-gray-400">Failed to load exit form data.</div>;

  const reasonChart = data.reason_summary.map((r) => ({
    reason: REASON_LABELS[r.reason] || r.reason,
    count: r.count,
  }));

  const trendChart = data.trend.map((t) => ({
    date: t.date.slice(5),
    count: t.count,
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
        <ClipboardList className="h-6 w-6" />
        Exit Form Analytics
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Total Exit Forms" value={data.total} color="yellow" />
        <KPICard label="Last 7 Days" value={data.last_7d} color="red" />
        <KPICard
          label="Top Reason"
          value={REASON_LABELS[data.top_reason] || data.top_reason}
          color="red"
        />
      </div>

      {/* Reason Distribution */}
      {reasonChart.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">Cancellation Reasons</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={reasonChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#666" fontSize={10} />
              <YAxis type="category" dataKey="reason" stroke="#666" fontSize={10} width={120} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Bar dataKey="count" fill="#ef4444" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trend */}
      {trendChart.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">Exit Forms Over Time (30d)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trendChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Area type="monotone" dataKey="count" stroke="#ef4444" fill="#ef444433" name="Submissions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Entries */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">Recent Exit Forms</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-gray-500">No exit forms submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs">
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Reason</th>
                  <th className="text-left p-2">Detail</th>
                  <th className="text-left p-2">Feedback</th>
                  <th className="text-left p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((f) => (
                  <tr key={f.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-2 font-mono text-xs">
                      <Link href={`/admin/retention/users/${f.provider_user_id}`} className="text-yellow-400 hover:underline">
                        {f.provider_user_id.slice(0, 12)}...
                      </Link>
                    </td>
                    <td className="p-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300">
                        {REASON_LABELS[f.reason_category] || f.reason_category}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-gray-300 max-w-[200px] truncate">{f.reason_detail || "—"}</td>
                    <td className="p-2 text-xs text-gray-300 max-w-[200px] truncate">{f.feedback || "—"}</td>
                    <td className="p-2 text-xs text-gray-400">{new Date(f.submitted_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
