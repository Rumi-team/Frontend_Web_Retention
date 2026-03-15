"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (result: { imported: number; skipped: number; parse_errors: string[] }) => void;
}

export default function ImportModal({ open, onClose, onImport }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState("");
  const [preview, setPreview] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFile = (f: File) => {
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const rows = lines.slice(0, 6).map((l) => l.split(",").map((c) => c.trim()));
      setPreview(rows);
      if (lines.length > 501) {
        setError(`File has ${lines.length - 1} rows. Max is 500.`);
      }
    };
    reader.readAsText(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (batchName) formData.append("batch_name", batchName);

    try {
      const res = await fetch("/api/admin/retention/crm/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }
      onImport(data);
      onClose();
      setFile(null);
      setPreview([]);
      setBatchName("");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Import CSV</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          CSV with columns: name (required), email, phone, batch_name, notes.
          Max 500 rows.
        </p>

        {!file ? (
          <div
            className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-yellow-500/50"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Click to select CSV file</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        ) : (
          <>
            <div className="bg-gray-800 rounded p-3 mb-3">
              <p className="text-sm text-white mb-2">
                {file.name} ({preview.length > 1 ? preview.length - 1 : 0} rows
                preview)
              </p>
              <div className="overflow-x-auto">
                <table className="text-xs text-gray-300">
                  <tbody>
                    {preview.map((row, i) => (
                      <tr
                        key={i}
                        className={i === 0 ? "text-gray-500 font-medium" : ""}
                      >
                        {row.map((cell, j) => (
                          <td key={j} className="pr-4 py-0.5">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">
                Batch name (optional, overrides CSV column)
              </label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                placeholder="YC Batch"
              />
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-400 mt-2">{error}</p>
        )}

        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleSubmit}
            disabled={!file || loading || !!error}
            className="flex-1 bg-yellow-500 text-black hover:bg-yellow-400"
          >
            {loading ? "Importing..." : "Import"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              setFile(null);
              setPreview([]);
              setError(null);
            }}
            className="border-gray-700 text-gray-400"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
