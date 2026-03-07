import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  // Get authenticated user from session
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify email + code against access_invites table
  const adminClient = createServerSupabaseClient();
  const { data: invite } = await adminClient
    .from("access_invites")
    .select("email")
    .eq("email", user.email)
    .eq("code", code.trim().toUpperCase())
    .single();

  if (!invite) {
    return NextResponse.json({ error: "Invalid access code" }, { status: 403 });
  }

  // Grant access by setting app_metadata
  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    user.id,
    { app_metadata: { access_verified: true } }
  );

  if (updateError) {
    return NextResponse.json({ error: "Failed to grant access" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
