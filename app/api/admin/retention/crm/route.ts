import { NextRequest, NextResponse } from "next/server";
import { createRetentionLayerClient } from "@/lib/supabase";
import { createAccessCode } from "@/lib/crm/access-code";
import {
  detectSignups,
  updateContactsFromDetection,
  discoverOrganicSignups,
} from "@/lib/crm/detect-signups";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createRetentionLayerClient();
  const batchFilter = req.nextUrl.searchParams.get("batch");
  const statusFilter = req.nextUrl.searchParams.get("status");
  const search = req.nextUrl.searchParams.get("q");

  // Auto-discover organic signups (users who signed up without invite)
  await discoverOrganicSignups();

  // Fetch all contacts
  let query = supabase
    .from("crm_contacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (batchFilter) {
    query = query.eq("batch_name", batchFilter);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: contacts, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allContacts = contacts || [];

  // DELIGHT-5: Auto-detect signups for contacts missing signed_up_at
  const pending = allContacts.filter(
    (c) => !c.signed_up_at && (c.email || c.access_code)
  );

  if (pending.length > 0) {
    const detectionResults = await detectSignups(
      pending.map((c) => ({
        id: c.id,
        email: c.email,
        access_code: c.access_code,
      }))
    );
    const newSignups = detectionResults.filter((r) => r.signedUpAt);
    if (newSignups.length > 0) {
      await updateContactsFromDetection(newSignups);
      // Update the in-memory contacts with new data
      for (const result of newSignups) {
        const contact = allContacts.find((c) => c.id === result.contactId);
        if (contact) {
          contact.signed_up_at = result.signedUpAt;
          contact.first_session_at = result.firstSessionAt;
          contact.total_sessions = result.totalSessions;
          contact.total_minutes = result.totalMinutes;
          contact.last_session_at = result.lastSessionAt;
        }
      }
    }
  }

  // Apply status filter after detection
  let filtered = allContacts;
  if (statusFilter) {
    switch (statusFilter) {
      case "not_invited":
        filtered = allContacts.filter((c) => !c.invited_at);
        break;
      case "invited":
        filtered = allContacts.filter((c) => c.invited_at && !c.signed_up_at);
        break;
      case "signed_up":
        filtered = allContacts.filter(
          (c) => c.signed_up_at && !c.first_session_at
        );
        break;
      case "active":
        filtered = allContacts.filter(
          (c) => c.first_session_at && c.total_sessions < 2
        );
        break;
      case "retained":
        filtered = allContacts.filter((c) => c.total_sessions >= 2);
        break;
    }
  }

  // Funnel KPIs
  const funnel = {
    total: allContacts.length,
    invited: allContacts.filter((c) => c.invited_at).length,
    signed_up: allContacts.filter((c) => c.signed_up_at).length,
    first_session: allContacts.filter((c) => c.first_session_at).length,
    retained: allContacts.filter((c) => c.total_sessions >= 2).length,
  };

  // DELIGHT-7: Batch names for filter dropdown
  const batches = [
    ...new Set(allContacts.map((c) => c.batch_name).filter(Boolean)),
  ];

  return NextResponse.json({ contacts: filtered, funnel, batches });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, batch_name, notes } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json(
      { error: "Email or phone is required" },
      { status: 400 }
    );
  }
  if (email) {
    const emails = email.split(",").map((e: string) => e.trim()).filter(Boolean);
    for (const addr of emails) {
      if (!EMAIL_REGEX.test(addr)) {
        return NextResponse.json(
          { error: `Invalid email: ${addr}` },
          { status: 400 }
        );
      }
    }
  }

  // Create access code (inserts into access_codes table too)
  const { code, error: codeError } = await createAccessCode(name, email || null);
  if (codeError) {
    return NextResponse.json(
      { error: `Failed to create access code: ${codeError}` },
      { status: 500 }
    );
  }

  const supabase = createRetentionLayerClient();
  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      batch_name: batch_name || null,
      notes: notes || null,
      access_code: code,
      source: "manual",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}
