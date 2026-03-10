import { NextRequest, NextResponse } from "next/server";
import { createRetentionDataClient } from "@/lib/supabase";

export async function GET() {
  // Auth handled by middleware
  const supabase = createRetentionDataClient();

  const { data: configs } = await supabase
    .schema("retention")
    .from("policy_config")
    .select("*")
    .order("published_at", { ascending: false });

  return NextResponse.json({ configs: configs || [] });
}

export async function POST(req: NextRequest) {
  // Auth handled by middleware
  const body = await req.json();
  const { version, config_json, notes } = body;

  if (!version || !config_json) {
    return NextResponse.json(
      { error: "version and config_json required" },
      { status: 400 }
    );
  }

  const supabase = createRetentionDataClient();

  // Deactivate current active config
  await supabase
    .schema("retention")
    .from("policy_config")
    .update({ is_active: false })
    .eq("is_active", true);

  // Insert new version
  const { data, error } = await supabase
    .schema("retention")
    .from("policy_config")
    .insert({
      version,
      config_json,
      published_by: "admin",
      is_active: true,
      notes: notes || "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data });
}
