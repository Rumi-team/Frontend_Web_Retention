import { NextRequest, NextResponse } from "next/server";
import { createRetentionLayerClient } from "@/lib/supabase";
import { createAccessCode } from "@/lib/crm/access-code";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORMULA_PREFIXES = ["=", "+", "-", "@"];

function sanitizeField(value: string): string {
  let trimmed = value.trim();
  if (FORMULA_PREFIXES.some((p) => trimmed.startsWith(p))) {
    trimmed = "'" + trimmed;
  }
  return trimmed;
}

interface CsvRow {
  name: string;
  email?: string;
  phone?: string;
  batch_name?: string;
  notes?: string;
}

function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV must have a header row and at least one data row"] };
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const emailIdx = header.indexOf("email");
  const phoneIdx = header.indexOf("phone");
  const batchIdx = header.indexOf("batch_name");
  const notesIdx = header.indexOf("notes");

  if (nameIdx === -1) {
    return { rows: [], errors: ["CSV must have a 'name' column"] };
  }
  if (emailIdx === -1 && phoneIdx === -1) {
    return { rows: [], errors: ["CSV must have an 'email' or 'phone' column"] };
  }

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const name = sanitizeField(cols[nameIdx] || "");
    if (!name) {
      errors.push(`Row ${i + 1}: missing name`);
      continue;
    }

    const email = emailIdx >= 0 ? sanitizeField(cols[emailIdx] || "") : undefined;
    const phone = phoneIdx >= 0 ? sanitizeField(cols[phoneIdx] || "") : undefined;

    if (!email && !phone) {
      errors.push(`Row ${i + 1}: must have email or phone`);
      continue;
    }

    if (email && !EMAIL_REGEX.test(email)) {
      errors.push(`Row ${i + 1}: invalid email "${email}"`);
      continue;
    }

    rows.push({
      name,
      email: email || undefined,
      phone: phone || undefined,
      batch_name: batchIdx >= 0 ? sanitizeField(cols[batchIdx] || "") || undefined : undefined,
      notes: notesIdx >= 0 ? sanitizeField(cols[notesIdx] || "") || undefined : undefined,
    });
  }

  return { rows, errors };
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const batchName = formData.get("batch_name") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const { rows, errors } = parseCsv(text);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found", parse_errors: errors },
      { status: 400 }
    );
  }

  if (rows.length > 500) {
    return NextResponse.json(
      { error: "Max 500 contacts per import" },
      { status: 400 }
    );
  }

  const supabase = createRetentionLayerClient();
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    // Create access code for each contact
    const { code, error: codeError } = await createAccessCode(
      row.name,
      row.email || null
    );
    if (codeError) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("crm_contacts").insert({
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      batch_name: batchName || row.batch_name || null,
      notes: row.notes || null,
      access_code: code,
      source: "csv_import",
    });

    if (error) {
      // Likely duplicate email
      skipped++;
    } else {
      imported++;
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    parse_errors: errors,
    total_rows: rows.length,
  });
}
