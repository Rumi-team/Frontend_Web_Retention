import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeRetentionMatrix } from "@/lib/retention/analytics";
import type { RetentionMode } from "@/lib/retention/types";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const unit = (req.nextUrl.searchParams.get("unit") || "week") as "week" | "month";
  const mode = (req.nextUrl.searchParams.get("mode") || "first_time") as RetentionMode;

  // Try cache first
  const { data: cached } = await supabase
    .schema("retention")
    .from("cohort_cache")
    .select("cohort_date,period,cohort_size,retained_count,retention_rate")
    .eq("period_unit", unit)
    .eq("retention_mode", mode)
    .order("cohort_date", { ascending: true })
    .order("period", { ascending: true });

  if (cached && cached.length > 0) {
    // Reshape into CohortRow format
    const rowMap = new Map<string, { cohort_size: number; periods: Array<{ period: number; retained: number; rate: number }> }>();
    for (const c of cached) {
      if (!rowMap.has(c.cohort_date)) {
        rowMap.set(c.cohort_date, { cohort_size: c.cohort_size, periods: [] });
      }
      rowMap.get(c.cohort_date)!.periods.push({
        period: c.period,
        retained: c.retained_count,
        rate: c.retention_rate,
      });
    }

    const cohorts = [...rowMap.entries()].map(([date, data]) => ({
      cohort_label: date,
      cohort_size: data.cohort_size,
      retention_mode: mode,
      periods: data.periods.sort((a, b) => a.period - b.period),
    }));

    return NextResponse.json({ cohorts, period_unit: unit, source: "cache" });
  }

  // Compute on the fly from events
  const { data: events } = await supabase
    .schema("retention")
    .from("events")
    .select("provider_user_id,timestamp")
    .eq("event_type", "session_start")
    .order("timestamp", { ascending: true });

  if (!events?.length) {
    return NextResponse.json({ cohorts: [], period_unit: unit, source: "empty" });
  }

  const cohorts = computeRetentionMatrix(
    events.map((e) => ({ provider_user_id: e.provider_user_id, timestamp: e.timestamp })),
    mode,
    unit,
    12,
  );

  return NextResponse.json({ cohorts, period_unit: unit, source: "computed" });
}
