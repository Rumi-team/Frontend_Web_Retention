"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon?: LucideIcon;
  color?: "yellow" | "green" | "red" | "blue" | "gray";
  className?: string;
}

const trendColors = {
  positive: "text-green-400",
  negative: "text-red-400",
  neutral: "text-gray-400",
};

const iconColors = {
  yellow: "text-yellow-400",
  green: "text-green-400",
  red: "text-red-400",
  blue: "text-blue-400",
  gray: "text-gray-400",
};

export function KPICard({
  label,
  value,
  trend,
  trendLabel,
  icon: Icon,
  color = "yellow",
  className,
}: KPICardProps) {
  const trendDirection =
    trend === undefined || trend === 0
      ? "neutral"
      : trend > 0
        ? "positive"
        : "negative";

  return (
    <div
      className={cn(
        "bg-gray-900 border border-gray-800 rounded-lg p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", iconColors[color])} />}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {trend !== undefined && (
        <p className={cn("text-xs mt-1", trendColors[trendDirection])}>
          {trend > 0 ? "+" : ""}
          {trend}
          {trendLabel ? ` ${trendLabel}` : ""}
        </p>
      )}
    </div>
  );
}
