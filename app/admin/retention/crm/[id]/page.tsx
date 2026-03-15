"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Copy,
  Link2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ContactTimeline from "@/components/crm/contact-timeline";

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
  created_at: string;
}

interface TimelineEntry {
  date: string;
  type: string;
  detail: string;
}

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [contact, setContact] = useState<Contact | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch(`/api/admin/retention/crm/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setContact(data.contact);
        setTimeline(data.timeline || []);
        setLoading(false);
      });
  }, [id]);

  const sendEmail = async (type = "invite") => {
    setSending(true);
    const res = await fetch("/api/admin/retention/crm/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: id, channel: "email", type }),
    });
    const data = await res.json();
    setSending(false);
    showToast(data.success ? "Email sent!" : data.error || "Failed");
    const r = await fetch(`/api/admin/retention/crm/${id}`);
    const refreshed = await r.json();
    setContact(refreshed.contact);
    setTimeline(refreshed.timeline || []);
  };

  const copyLink = () => {
    if (!contact?.access_code) return;
    navigator.clipboard.writeText(
      `https://rumi.team/login?ref=${encodeURIComponent(contact.access_code)}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyMessage = () => {
    if (!contact) return;
    const url = `https://rumi.team/login?ref=${encodeURIComponent(contact.access_code || "")}`;
    const msg = `Hey ${contact.name}! You're invited to try Rumi \u2014 an AI coaching companion that helps you grow. Your access code: ${contact.access_code}\n\nStart here: ${url}`;
    navigator.clipboard.writeText(msg);
    showToast("Invite message copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-500">Loading...</div>
    );
  }

  if (!contact) {
    return (
      <div className="p-6 text-red-400">Contact not found</div>
    );
  }

  const needsNudge =
    contact.signed_up_at &&
    (contact.total_sessions === 0 ||
      (contact.last_session_at &&
        Date.now() - new Date(contact.last_session_at).getTime() > 7 * 86400000));

  const status = contact.total_sessions >= 2
    ? "Retained"
    : contact.first_session_at
      ? "Active"
      : contact.signed_up_at
        ? "Signed Up"
        : contact.invited_at
          ? "Invited"
          : "Not Invited";

  return (
    <div className="p-6 max-w-3xl">
      {/* Back link */}
      <Link
        href="/admin/retention/crm"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to CRM
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{contact.name}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {contact.email || contact.phone}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Status</p>
          <p className="text-lg font-semibold text-white">{status}</p>
          {contact.signed_up_at && (
            <p className="text-xs text-gray-500">
              {new Date(contact.signed_up_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Sessions</p>
          <p className="text-lg font-semibold text-white">
            {contact.total_sessions}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total Minutes</p>
          <p className="text-lg font-semibold text-white">
            {contact.total_minutes}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Access Code</p>
          <p className="text-lg font-semibold text-yellow-400 font-mono">
            {contact.access_code || "\u2014"}
          </p>
        </div>
      </div>

      {/* Batch + notes */}
      {(contact.batch_name || contact.notes) && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          {contact.batch_name && (
            <p className="text-sm text-gray-400">
              <span className="text-gray-500">Batch:</span> {contact.batch_name}
            </p>
          )}
          {contact.notes && (
            <p className="text-sm text-gray-400 mt-1">
              <span className="text-gray-500">Notes:</span> {contact.notes}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {contact.email && (
          <Button
            onClick={() => sendEmail()}
            disabled={sending}
            className="bg-yellow-500 text-black hover:bg-yellow-400"
          >
            <Mail className="h-4 w-4 mr-1" /> Send Email
          </Button>
        )}
        {contact.access_code && (
          <Button
            onClick={copyMessage}
            variant="outline"
            className="border-gray-700 text-gray-300"
          >
            <Copy className="h-4 w-4 mr-1" /> Copy Message
          </Button>
        )}
        {contact.access_code && (
          <Button
            onClick={copyLink}
            variant="outline"
            className="border-gray-700 text-gray-300"
          >
            <Link2 className="h-4 w-4 mr-1" />
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        )}
        {needsNudge && contact.email && (
          <Button
            onClick={() => sendEmail("nudge")}
            disabled={sending}
            variant="outline"
            className="border-yellow-600 text-yellow-500 hover:text-yellow-400"
          >
            <Zap className="h-4 w-4 mr-1" /> Nudge
          </Button>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
          Timeline
        </h2>
        <ContactTimeline entries={timeline} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
