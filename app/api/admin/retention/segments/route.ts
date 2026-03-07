import { NextResponse } from "next/server";
import { computeSegments } from "@/lib/retention/segments";

export async function GET() {
  // Auth handled by middleware
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
