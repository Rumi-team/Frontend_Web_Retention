import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_REASONS = [
  "too_expensive", "not_useful", "found_alternative",
  "too_complex", "missing_features", "bugs", "other",
];

/**
 * Public endpoint for cancellation exit form submission.
 * Auth: X-API-Key header must match RETENTION_API_KEY.
 * Called from iOS app / web app cancellation flow.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.RETENTION_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    provider_user_id?: string;
    reason_category?: string;
    reason_detail?: string;
    feedback?: string;
    plan_at_exit?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.provider_user_id || !body.reason_category) {
    return NextResponse.json(
      { error: "provider_user_id and reason_category are required" },
      { status: 400 },
    );
  }

  if (!VALID_REASONS.includes(body.reason_category)) {
    return NextResponse.json(
      { error: `Invalid reason_category. Must be one of: ${VALID_REASONS.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase
    .schema("retention")
    .from("exit_forms")
    .insert({
      provider_user_id: body.provider_user_id,
      reason_category: body.reason_category,
      reason_detail: body.reason_detail || "",
      feedback: body.feedback || "",
      plan_at_exit: body.plan_at_exit || "",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
