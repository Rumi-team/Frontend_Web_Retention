import { NextRequest, NextResponse } from "next/server";
import { computeSegments } from "@/lib/retention/segments";

function isAuthorized(req: NextRequest): boolean {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  if (!ADMIN_SECRET) return true; // dev mode
  const cookie = req.cookies.get("admin_token")?.value;
  if (cookie === ADMIN_SECRET) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${ADMIN_SECRET}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const segments = await computeSegments();
    return NextResponse.json({ segments });
  } catch {
    return NextResponse.json(
      { error: "Failed to compute segments" },
      { status: 500 }
    );
  }
}
