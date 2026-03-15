"use client";

import { Mail, UserCheck, Headphones, MessageSquare } from "lucide-react";

interface TimelineEntry {
  date: string;
  type: string;
  detail: string;
}

const ICON_MAP: Record<string, typeof Mail> = {
  invite: Mail,
  signup: UserCheck,
  session: Headphones,
  sms: MessageSquare,
};

const COLOR_MAP: Record<string, string> = {
  invite: "text-blue-400 bg-blue-900/30",
  signup: "text-green-400 bg-green-900/30",
  session: "text-yellow-400 bg-yellow-900/30",
};

export default function ContactTimeline({
  entries,
}: {
  entries: TimelineEntry[];
}) {
  if (entries.length === 0) {
    return <p className="text-gray-500 text-sm">No activity yet.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => {
        const Icon = ICON_MAP[entry.type] || Mail;
        const color = COLOR_MAP[entry.type] || "text-gray-400 bg-gray-800/50";
        return (
          <div key={i} className="flex items-start gap-3">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${color}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">{entry.detail}</p>
              <p className="text-xs text-gray-500">
                {new Date(entry.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
