"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

interface ContactData {
  name: string;
  email: string;
  phone: string;
  batch_name: string;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ContactData) => void;
  loading?: boolean;
  initialData?: ContactData | null;
}

export default function AddContactModal({
  open,
  onClose,
  onSubmit,
  loading,
  initialData,
}: Props) {
  const [name, setName] = useState("");
  const [emails, setEmails] = useState<string[]>([""]);
  const [phone, setPhone] = useState("");
  const [batchName, setBatchName] = useState("");
  const [notes, setNotes] = useState("");

  const isEdit = !!initialData;

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name);
      const parsed = initialData.email
        ? initialData.email.split(",").map((e) => e.trim())
        : [""];
      setEmails(parsed.length > 0 ? parsed : [""]);
      setPhone(initialData.phone);
      setBatchName(initialData.batch_name);
      setNotes(initialData.notes);
    } else if (open && !initialData) {
      setName("");
      setEmails([""]);
      setPhone("");
      setBatchName("");
      setNotes("");
    }
  }, [open, initialData]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const joinedEmail = emails.map((e) => e.trim()).filter(Boolean).join(", ");
    onSubmit({
      name,
      email: joinedEmail,
      phone,
      batch_name: batchName,
      notes,
    });
  };

  const updateEmail = (index: number, value: string) => {
    const next = [...emails];
    next[index] = value;
    setEmails(next);
  };

  const addEmailField = () => {
    setEmails([...emails, ""]);
  };

  const removeEmailField = (index: number) => {
    if (emails.length <= 1) return;
    setEmails(emails.filter((_, i) => i !== index));
  };

  const hasContact = emails.some((e) => e.trim()) || phone.trim();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? "Edit Contact" : "Add Contact"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Email(s)
            </label>
            {emails.map((email, i) => (
              <div key={i} className="flex gap-1 mb-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => updateEmail(i, e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                  placeholder={i === 0 ? "jane@example.com" : "alt@example.com"}
                />
                {emails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEmailField(i)}
                    className="px-2 text-gray-500 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addEmailField}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 mt-1"
            >
              <Plus className="h-3 w-3" /> Add another email
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              placeholder="+14155551234"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Batch</label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              placeholder="Friends & Family"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={!name || !hasContact || loading}
              className="flex-1 bg-yellow-500 text-black hover:bg-yellow-400"
            >
              {loading
                ? isEdit
                  ? "Saving..."
                  : "Adding..."
                : isEdit
                  ? "Save Changes"
                  : "Add Contact"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-400"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
