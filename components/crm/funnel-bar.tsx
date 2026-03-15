"use client";

interface FunnelData {
  total: number;
  invited: number;
  signed_up: number;
  first_session: number;
  retained: number;
}

const STAGES: { key: keyof FunnelData; label: string; color: string }[] = [
  { key: "total", label: "Total", color: "bg-gray-700" },
  { key: "invited", label: "Invited", color: "bg-blue-600" },
  { key: "signed_up", label: "Signed Up", color: "bg-yellow-500" },
  { key: "first_session", label: "Session", color: "bg-orange-500" },
  { key: "retained", label: "Retained", color: "bg-green-500" },
];

export default function FunnelBar({ data }: { data: FunnelData }) {
  const pct = (n: number) =>
    data.total > 0 ? Math.round((n / data.total) * 100) : 0;

  return (
    <div className="flex gap-3 flex-wrap">
      {STAGES.map(({ key, label, color }) => (
        <div
          key={key}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 min-w-[100px]"
        >
          <p className="text-2xl font-bold text-white">{data[key]}</p>
          <p className="text-xs text-gray-500 mt-1">
            {label}
            {key !== "total" && (
              <span className="ml-1 text-gray-600">{pct(data[key])}%</span>
            )}
          </p>
          {key !== "total" && (
            <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full`}
                style={{ width: `${pct(data[key])}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
