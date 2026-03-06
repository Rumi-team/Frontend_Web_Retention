"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, AlertTriangle, Globe } from "lucide-react";
import type { Segment } from "@/lib/retention/types";

const SEGMENT_ICONS: Record<string, React.ReactNode> = {
  all_users: <Globe className="h-5 w-5 text-yellow-400" />,
  new_users: <TrendingUp className="h-5 w-5 text-green-400" />,
  active_frequent: <Users className="h-5 w-5 text-blue-400" />,
  lapsed: <AlertTriangle className="h-5 w-5 text-red-400" />,
};

const SEGMENT_COLORS: Record<string, string> = {
  all_users: "border-yellow-400/30",
  new_users: "border-green-400/30",
  active_frequent: "border-blue-400/30",
  lapsed: "border-red-400/30",
};

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/retention/segments")
      .then((r) => r.json())
      .then((data) => {
        setSegments(data.segments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="p-8 text-gray-400">Loading segments...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-yellow-400">User Segments</h1>
      <p className="text-sm text-gray-400">
        Pre-built segments based on session activity patterns.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {segments.map((seg) => (
          <div
            key={seg.name}
            className={`bg-gray-900 border ${
              SEGMENT_COLORS[seg.name] || "border-gray-800"
            } rounded-lg p-6`}
          >
            <div className="flex items-center gap-3 mb-3">
              {SEGMENT_ICONS[seg.name] || (
                <Users className="h-5 w-5 text-gray-400" />
              )}
              <h3 className="font-semibold capitalize">
                {seg.name.replace(/_/g, " ")}
              </h3>
            </div>
            <p className="text-3xl font-bold">{seg.count}</p>
            <p className="text-xs text-gray-400 mt-2">{seg.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
