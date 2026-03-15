"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    email: string;
    phone: string;
    batch_name: string;
    notes: string;
  }) => void;
  loading?: boolean;
}

export default function AddContactModal({
  open,
  onClose,
  onSubmit,
  loading,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [batchName, setBatchName] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, email, phone, batch_name: batchName, notes });
    setName("");
    setEmail("");
    setPhone("");
    setBatchName("");
    setNotes("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Add Contact</h2>
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
            <label className="text-xs text-gray-400 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              placeholder="jane@example.com"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Phone (E.164)
            </label>
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
              disabled={!name || (!email && !phone) || loading}
              className="flex-1 bg-yellow-500 text-black hover:bg-yellow-400"
            >
              {loading ? "Adding..." : "Add Contact"}
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
