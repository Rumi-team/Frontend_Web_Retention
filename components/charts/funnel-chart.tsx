"use client";

import { cn } from "@/lib/utils";
import type { FunnelStep } from "@/lib/retention/types";

interface FunnelChartProps {
  steps: FunnelStep[];
  className?: string;
}

export function FunnelChart({ steps, className }: FunnelChartProps) {
  if (!steps.length) return null;

  const maxCount = steps[0]?.count || 1;

  return (
    <div className={cn("space-y-2", className)}>
      {steps.map((step, i) => {
        const widthPct = (step.count / maxCount) * 100;
        const prevCount = i > 0 ? steps[i - 1].count : step.count;
        const dropOff = prevCount > 0 ? ((prevCount - step.count) / prevCount) * 100 : 0;

        return (
          <div key={step.name} className="flex items-center gap-3">
            <div className="w-36 text-xs text-gray-300 text-right shrink-0">
              {step.name}
            </div>
            <div className="flex-1 relative">
              <div className="bg-gray-800 rounded-full h-6 w-full">
                <div
                  className="bg-yellow-400/80 h-6 rounded-full flex items-center px-2 transition-all"
                  style={{ width: `${Math.max(widthPct, 2)}%` }}
                >
                  <span className="text-xs font-mono text-black font-semibold whitespace-nowrap">
                    {step.count.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="w-24 text-xs shrink-0 text-right">
              <span className="text-gray-300">
                {step.conversion_rate.toFixed(1)}%
              </span>
              {i > 0 && dropOff > 0 && (
                <span className="text-red-400 ml-1">
                  -{dropOff.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
