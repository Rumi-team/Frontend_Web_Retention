import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Access code is required" }, { status: 400 });
    }

    const adminClient = createServerSupabaseClient();

    // Already redeemed — idempotent
    const { data: existingRedemption } = await adminClient
      .from("access_code_redemptions")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existingRedemption) {
      await adminClient.auth.admin.updateUserById(user.id, {
        app_metadata: { access_verified: true },
      });
      return NextResponse.json({ success: true });
    }

    // Find the code
    const { data: accessCode, error: codeError } = await adminClient
      .from("access_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    if (codeError || !accessCode) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 400 });
    }

    // Check email match if code is assigned
    if (accessCode.assigned_email) {
      const userEmail = user.email?.toLowerCase() ?? "";
      if (accessCode.assigned_email.toLowerCase() !== userEmail) {
        return NextResponse.json(
          { error: "This code is assigned to a different email address" },
          { status: 400 }
        );
      }
    }

    // Check expiry
    if (accessCode.expires_at && new Date(accessCode.expires_at) < new Date()) {
      return NextResponse.json({ error: "This access code has expired" }, { status: 400 });
    }

    // Check max uses
    if (accessCode.max_uses !== null && accessCode.used_count >= accessCode.max_uses) {
      return NextResponse.json(
        { error: "This access code has reached its usage limit" },
        { status: 400 }
      );
    }

    // Redeem
    const { error: redemptionError } = await adminClient
      .from("access_code_redemptions")
      .insert({ code_id: accessCode.id, user_id: user.id });

    if (redemptionError) {
      return NextResponse.json({ error: "Failed to redeem code" }, { status: 500 });
    }

    await adminClient
      .from("access_codes")
      .update({ used_count: accessCode.used_count + 1 })
      .eq("id", accessCode.id);

    await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: { access_verified: true },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
