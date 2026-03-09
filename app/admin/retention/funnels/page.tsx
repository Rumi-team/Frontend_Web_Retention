"use client";

import { useEffect, useState } from "react";
import { Filter } from "lucide-react";
import { KPICard } from "@/components/charts/kpi-card";
import { FunnelChart } from "@/components/charts/funnel-chart";
import type { FunnelStep } from "@/lib/retention/types";

interface ABComparison {
  control: { total: number; steps: number[] };
  treatment: { total: number; steps: number[] };
}

interface FunnelData {
  funnel_name: string;
  steps: FunnelStep[];
  total_users: number;
  ab_comparison: ABComparison | null;
}

const STEP_NAMES = ["First Visit", "Second Session (7d)", "Weekly User (3+/wk)", "Repeat Weekly", "Power User (APU)"];

export default function FunnelsDashboard() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention/funnels")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading funnel data...</div>;
  if (!data) return <div className="p-8 text-gray-400">Failed to load funnel data.</div>;

  // Find biggest drop-off
  let biggestDrop = { from: "", to: "", dropPct: 0 };
  for (let i = 1; i < data.steps.length; i++) {
    const prev = data.steps[i - 1].count;
    const curr = data.steps[i].count;
    const dropPct = prev > 0 ? ((prev - curr) / prev) * 100 : 0;
    if (dropPct > biggestDrop.dropPct) {
      biggestDrop = { from: data.steps[i - 1].name, to: data.steps[i].name, dropPct };
    }
  }

  const overallConversion = data.steps.length >= 2 && data.steps[0].count > 0
    ? ((data.steps[data.steps.length - 1].count / data.steps[0].count) * 100).toFixed(1)
    : "0";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
        <Filter className="h-6 w-6" />
        Conversion Funnel
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Total Users" value={data.total_users} color="blue" />
        <KPICard label="End-to-End Conversion" value={`${overallConversion}%`} color="yellow" />
        <KPICard
          label="Biggest Drop-off"
          value={biggestDrop.from ? `${biggestDrop.dropPct.toFixed(0)}%` : "—"}
          color="red"
        />
        <KPICard
          label="APU (Power Users)"
          value={data.steps[data.steps.length - 1]?.count || 0}
          color="green"
        />
      </div>

      {/* Main Funnel */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-4 text-gray-300">{data.funnel_name}</h2>
        {data.steps.length > 0 ? (
          <FunnelChart steps={data.steps} />
        ) : (
          <p className="text-sm text-gray-500">No funnel data yet.</p>
        )}
        {biggestDrop.from && (
          <p className="text-xs text-gray-400 mt-4">
            Biggest drop: <span className="text-red-400">{biggestDrop.from} → {biggestDrop.to}</span> ({biggestDrop.dropPct.toFixed(0)}% lost)
          </p>
        )}
      </div>

      {/* A/B Comparison */}
      {data.ab_comparison && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300">Control vs Treatment Funnel</h2>
          <div className="grid grid-cols-2 gap-6">
            {(["control", "treatment"] as const).map((group) => {
              const groupData = data.ab_comparison![group];
              const groupSteps: FunnelStep[] = STEP_NAMES.map((name, i) => ({
                name,
                event_type: "",
                count: groupData.steps[i] || 0,
                conversion_rate: groupData.total > 0 ? Math.round((groupData.steps[i] / groupData.total) * 1000) / 10 : 0,
                drop_off: i > 0 ? (groupData.steps[i - 1] || 0) - (groupData.steps[i] || 0) : 0,
              }));

              return (
                <div key={group}>
                  <h3 className="text-xs font-semibold mb-3 capitalize">
                    <span className={group === "control" ? "text-gray-400" : "text-yellow-400"}>
                      {group}
                    </span>
                    <span className="text-gray-500 ml-2">n={groupData.total}</span>
                  </h3>
                  <FunnelChart steps={groupSteps} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
