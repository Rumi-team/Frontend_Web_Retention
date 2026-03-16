"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Copy, Link2, Zap, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  access_code: string | null;
  batch_name: string | null;
  notes: string | null;
  invited_at: string | null;
  signed_up_at: string | null;
  first_session_at: string | null;
  total_sessions: number;
  total_minutes: number;
  last_session_at: string | null;
}

function getStatus(c: Contact): { label: string; color: string } {
  if (c.total_sessions >= 2) return { label: "Retained", color: "text-green-400" };
  if (c.first_session_at) return { label: "Active", color: "text-blue-400" };
  if (c.signed_up_at) return { label: "Signed Up", color: "text-yellow-400" };
  if (c.invited_at) return { label: "Invited", color: "text-gray-400" };
  return { label: "Not Invited", color: "text-gray-600" };
}

function timeAgo(iso: string | null): string {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// DELIGHT-8: Sparkline for transformation_level scores
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="inline-block ml-2">
      <polyline
        points={points}
        fill="none"
        stroke="#facc15"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function needsNudge(c: Contact): boolean {
  if (!c.signed_up_at) return false;
  if (c.total_sessions === 0) return true;
  if (c.last_session_at) {
    const daysSince = (Date.now() - new Date(c.last_session_at).getTime()) / 86400000;
    return daysSince > 7;
  }
  return false;
}

interface Props {
  contacts: Contact[];
  transformationScores?: Record<string, number[]>;
  onSendEmail: (contactId: string, type?: string) => void;
  sending?: string | null;
  onCopyMessage?: (contact: Contact) => void;
  onEdit?: (contact: Contact) => void;
  onRemove?: (contact: Contact) => void;
}

function generateInviteMessage(c: Contact): string {
  const url = `https://rumi.team/login?ref=${encodeURIComponent(c.access_code || "")}`;
  return `Hey ${c.name}! You're invited to try Rumi \u2014 an AI coaching companion that helps you grow.\n\nStart here: ${url}`;
}

export default function ContactTable({
  contacts,
  transformationScores = {},
  onSendEmail,
  sending,
  onCopyMessage,
  onEdit,
  onRemove,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const copyLink = (contact: Contact) => {
    if (!contact.access_code) return;
    const url = `https://rumi.team/login?ref=${encodeURIComponent(contact.access_code)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(contact.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyMessage = (contact: Contact) => {
    const msg = generateInviteMessage(contact);
    navigator.clipboard.writeText(msg);
    setCopiedMsgId(contact.id);
    setTimeout(() => setCopiedMsgId(null), 2000);
    onCopyMessage?.(contact);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-left">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Contact</th>
            <th className="pb-2 font-medium">Batch</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Sessions</th>
            <th className="pb-2 font-medium">Last</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => {
            const status = getStatus(c);
            const scores = transformationScores[c.id];
            return (
              <tr
                key={c.id}
                className="border-b border-gray-800/50 hover:bg-gray-900/50"
              >
                <td className="py-2">
                  <Link
                    href={`/admin/retention/crm/${c.id}`}
                    className="text-white hover:text-yellow-400"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="py-2 text-gray-400">
                  {c.email && (
                    <div className="text-sm truncate max-w-[200px]" title={c.email}>
                      {c.email}
                    </div>
                  )}
                  {c.phone && (
                    <div className="text-xs text-gray-500">{c.phone}</div>
                  )}
                  {!c.email && !c.phone && "\u2014"}
                </td>
                <td className="py-2 text-gray-500">{c.batch_name || "\u2014"}</td>
                <td className="py-2">
                  <span className={status.color}>{status.label}</span>
                </td>
                <td className="py-2 text-gray-300">
                  {c.total_sessions > 0 ? (
                    <>
                      {c.total_sessions}
                      {scores && <Sparkline values={scores} />}
                    </>
                  ) : (
                    "\u2014"
                  )}
                </td>
                <td className="py-2 text-gray-500">{timeAgo(c.last_session_at)}</td>
                <td className="py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-gray-400 hover:text-yellow-400"
                      onClick={() => onEdit?.(c)}
                      title="Edit contact"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-gray-400 hover:text-red-400"
                      onClick={() => onRemove?.(c)}
                      title="Remove contact"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {c.email && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-gray-400 hover:text-yellow-400"
                        onClick={() => onSendEmail(c.id)}
                        disabled={sending === c.id}
                        title="Send email invite"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {c.access_code && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-gray-400 hover:text-yellow-400"
                        onClick={() => copyMessage(c)}
                        title="Copy invite message"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedMsgId === c.id && (
                          <span className="ml-1 text-xs text-green-400">Copied!</span>
                        )}
                      </Button>
                    )}
                    {c.access_code && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-gray-400 hover:text-yellow-400"
                        onClick={() => copyLink(c)}
                        title="Copy link only"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {copiedId === c.id && (
                          <span className="ml-1 text-xs text-green-400">Copied!</span>
                        )}
                      </Button>
                    )}
                    {needsNudge(c) && c.email && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-yellow-500 hover:text-yellow-300"
                        onClick={() => onSendEmail(c.id, "nudge")}
                        disabled={sending === c.id}
                        title="Send nudge email"
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {contacts.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-gray-500">
                No contacts yet. Add one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
