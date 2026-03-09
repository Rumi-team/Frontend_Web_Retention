"use client";

import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  sparkData?: number[];
  color?: string;
  className?: string;
}

/**
 * Compact card with an inline SVG sparkline.
 * No recharts dependency — pure SVG for minimal overhead.
 */
export function MetricCard({
  label,
  value,
  sparkData,
  color = "#eab308",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "bg-gray-900 border border-gray-800 rounded-lg p-4",
        className,
      )}
    >
      <p className="text-xs text-gray-400">{label}</p>
      <div className="flex items-end justify-between mt-1">
        <p className="text-2xl font-bold">{value}</p>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={color} />
        )}
      </div>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 64;
  const height = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
