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
import { DollarSign, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/charts/kpi-card";
import type { RevenueMetrics } from "@/lib/retention/types";

interface RevenueData extends RevenueMetrics {
  plan_price: number;
  is_estimated: boolean;
}

export default function RevenueDashboard() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention/revenue")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading revenue data...</div>;
  if (!data) return <div className="p-8 text-gray-400">Failed to load revenue data.</div>;

  const mrrChart = data.mrr_trend.map((m) => ({
    month: m.date,
    mrr: m.mrr,
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
        <DollarSign className="h-6 w-6" />
        Revenue Analytics
      </h1>

      {data.is_estimated && (
        <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-400">
            Revenue data is estimated from session activity. Set <code className="bg-gray-800 px-1 rounded text-xs">RUMI_APP_SUPABASE_URL</code> and <code className="bg-gray-800 px-1 rounded text-xs">RUMI_APP_SUPABASE_SERVICE_KEY</code> for precise subscription data.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="MRR" value={`$${data.mrr.toLocaleString()}`} color="green" icon={DollarSign} />
        <KPICard label="Churn Rate" value={`${data.churn_rate}%`} color={data.churn_rate > 10 ? "red" : "yellow"} />
        <KPICard label="LTV Estimate" value={`$${data.ltv_estimate}`} color="blue" />
        <KPICard
          label="Revenue at Risk"
          value={`$${data.revenue_at_risk.toLocaleString()}`}
          color="red"
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400">Total Customers</p>
          <p className="text-2xl font-bold mt-1">{data.total_customers}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400">Plan Price</p>
          <p className="text-2xl font-bold mt-1">${data.plan_price}/mo</p>
        </div>
      </div>

      {/* MRR Trend */}
      {mrrChart.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4 text-gray-300">MRR Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mrrChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, "MRR"]}
              />
              <Area type="monotone" dataKey="mrr" stroke="#22c55e" fill="#22c55e33" name="MRR" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue at Risk detail */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">Revenue at Risk Breakdown</h2>
        <p className="text-sm text-gray-400">
          <span className="text-red-400 font-semibold">${data.revenue_at_risk.toLocaleString()}</span> from users with churn risk score &gt; 0.7 × ${data.plan_price}/mo plan price.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Visit the <a href="/admin/retention/churn" className="text-yellow-400 hover:underline">Churn Risk</a> page to see which users are at risk and whether the RL agent has intervened.
        </p>
      </div>
    </div>
  );
}
