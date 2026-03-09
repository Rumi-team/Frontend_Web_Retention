"use client";

import { cn } from "@/lib/utils";

interface HeatmapCell {
  value: number;
  label?: string;
}

interface HeatmapRow {
  label: string;
  sublabel?: string;
  cells: HeatmapCell[];
}

interface HeatmapProps {
  rows: HeatmapRow[];
  columnHeaders: string[];
  className?: string;
}

function getCellColor(value: number): string {
  if (value >= 0.5) return "bg-green-900/80 text-green-300";
  if (value >= 0.3) return "bg-green-900/50 text-green-400";
  if (value >= 0.2) return "bg-yellow-900/50 text-yellow-400";
  if (value >= 0.1) return "bg-orange-900/50 text-orange-400";
  if (value > 0) return "bg-red-900/50 text-red-400";
  return "bg-gray-800/50 text-gray-500";
}

export function Heatmap({ rows, columnHeaders, className }: HeatmapProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left p-2 text-gray-400 min-w-[100px]">
              Cohort
            </th>
            {columnHeaders.map((h) => (
              <th key={h} className="text-center p-2 text-gray-400 min-w-[60px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-gray-800/50">
              <td className="p-2">
                <span className="text-gray-300">{row.label}</span>
                {row.sublabel && (
                  <span className="text-gray-500 ml-1">{row.sublabel}</span>
                )}
              </td>
              {row.cells.map((cell, i) => (
                <td key={i} className="p-1 text-center">
                  <div
                    className={cn(
                      "rounded px-2 py-1 font-mono",
                      getCellColor(cell.value),
                    )}
                  >
                    {cell.label ?? `${Math.round(cell.value * 100)}%`}
                  </div>
                </td>
              ))}
              {/* Fill empty cells for shorter rows */}
              {Array.from(
                { length: columnHeaders.length - row.cells.length },
                (_, i) => (
                  <td key={`empty-${i}`} className="p-1" />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
