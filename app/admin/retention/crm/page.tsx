"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import FunnelBar from "@/components/crm/funnel-bar";
import ContactTable from "@/components/crm/contact-table";
import AddContactModal from "@/components/crm/add-contact-modal";
import ImportModal from "@/components/crm/import-modal";

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

interface FunnelData {
  total: number;
  invited: number;
  signed_up: number;
  first_session: number;
  retained: number;
}

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [funnel, setFunnel] = useState<FunnelData>({
    total: 0,
    invited: 0,
    signed_up: 0,
    first_session: 0,
    retained: 0,
  });
  const [batches, setBatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [batchFilter, setBatchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchContacts = useCallback(async () => {
    const params = new URLSearchParams();
    if (batchFilter) params.set("batch", batchFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("q", search);

    const res = await fetch(`/api/admin/retention/crm?${params}`);
    const data = await res.json();
    setContacts(data.contacts || []);
    setFunnel(data.funnel || { total: 0, invited: 0, signed_up: 0, first_session: 0, retained: 0 });
    setBatches(data.batches || []);
    setLoading(false);
  }, [batchFilter, statusFilter, search]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleAddContact = async (data: {
    name: string;
    email: string;
    phone: string;
    batch_name: string;
    notes: string;
  }) => {
    setAddLoading(true);
    const res = await fetch("/api/admin/retention/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setAddLoading(false);
    if (res.ok) {
      setShowAdd(false);
      showToast("Contact added");
      fetchContacts();
    } else {
      const err = await res.json();
      showToast(err.error || "Failed to add contact");
    }
  };

  const handleEditContact = async (data: {
    name: string;
    email: string;
    phone: string;
    batch_name: string;
    notes: string;
  }) => {
    if (!editContact) return;
    setAddLoading(true);
    const res = await fetch(`/api/admin/retention/crm/${editContact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setAddLoading(false);
    if (res.ok) {
      setEditContact(null);
      showToast("Contact updated");
      fetchContacts();
    } else {
      const err = await res.json();
      showToast(err.error || "Failed to update contact");
    }
  };

  const handleSendEmail = async (contactId: string, type = "invite") => {
    setSending(contactId);
    const res = await fetch("/api/admin/retention/crm/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId, channel: "email", type }),
    });
    const data = await res.json();
    setSending(null);

    if (data.success) {
      showToast(type === "nudge" ? "Nudge sent!" : "Email sent!");
      fetchContacts();
    } else {
      showToast(data.error || "Send failed");
    }
  };

  const handleImport = (result: {
    imported: number;
    skipped: number;
    parse_errors: string[];
  }) => {
    showToast(
      `Imported ${result.imported} contacts${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`
    );
    fetchContacts();
  };

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">CRM — Growth Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            Invite waitlist contacts, track signups, measure engagement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowAdd(true)}
            className="bg-yellow-500 text-black hover:bg-yellow-400"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Contact
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowImport(true)}
            className="border-gray-700 text-gray-300 hover:text-white"
          >
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
        </div>
      </div>

      {/* Funnel KPIs */}
      <div className="mb-6">
        <FunnelBar data={funnel} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:border-yellow-400 focus:outline-none"
        >
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:border-yellow-400 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="not_invited">Not Invited</option>
          <option value="invited">Invited</option>
          <option value="signed_up">Signed Up</option>
          <option value="active">Active</option>
          <option value="retained">Retained</option>
        </select>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:border-yellow-400 focus:outline-none w-48"
        />
      </div>

      {/* Contact Table */}
      {loading ? (
        <div className="text-gray-500 py-8 text-center">Loading...</div>
      ) : (
        <ContactTable
          contacts={contacts}
          onSendEmail={handleSendEmail}
          sending={sending}
          onCopyMessage={() => showToast("Invite message copied!")}
          onEdit={(c) => setEditContact(c)}
        />
      )}

      {/* Modals */}
      <AddContactModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={handleAddContact}
        loading={addLoading}
      />
      <AddContactModal
        open={!!editContact}
        onClose={() => setEditContact(null)}
        onSubmit={handleEditContact}
        loading={addLoading}
        initialData={
          editContact
            ? {
                name: editContact.name,
                email: editContact.email || "",
                phone: editContact.phone || "",
                batch_name: editContact.batch_name || "",
                notes: editContact.notes || "",
              }
            : null
        }
      />
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
