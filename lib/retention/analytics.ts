import type { LifecycleStage, CohortRow, RetentionMode, CorrelationResult } from "./types";

// ── Lifecycle: PostHog four-state Markov classification ──

/**
 * Classify a user into one of four lifecycle states for a given period.
 * Uses the PostHog model:
 *   New: first-ever event is in the current period
 *   Returning: active in both current and previous period
 *   Resurrecting: active in current period, not in previous, but was active before
 *   Dormant: was active at some point but not in the current period
 */
export function classifyLifecycleState(
  allTimestamps: string[],
  periodStart: Date,
  periodEnd: Date,
  previousPeriodStart: Date,
): LifecycleStage {
  if (!allTimestamps.length) return "dormant";

  const sorted = [...allTimestamps].sort();
  const firstEver = new Date(sorted[0]);

  const activeInCurrent = allTimestamps.some((t) => {
    const d = new Date(t);
    return d >= periodStart && d < periodEnd;
  });

  const activeInPrevious = allTimestamps.some((t) => {
    const d = new Date(t);
    return d >= previousPeriodStart && d < periodStart;
  });

  const hadActivityBefore = allTimestamps.some((t) => {
    const d = new Date(t);
    return d < periodStart;
  });

  if (!activeInCurrent) return "dormant";
  if (firstEver >= periodStart && firstEver < periodEnd) return "new";
  if (activeInPrevious) return "returning";
  if (hadActivityBefore) return "resurrecting";
  return "new";
}

// ── Churn risk scoring ──

interface ChurnFactors {
  [key: string]: number;
  days_since_last: number;
  frequency_trend: number;
  duration_trend: number;
  engagement_breadth: number;
  account_age_risk: number;
}

const CHURN_WEIGHTS = {
  days_since_last: 0.35,
  frequency_trend: 0.25,
  duration_trend: 0.15,
  engagement_breadth: 0.15,
  account_age_risk: 0.10,
};

/**
 * Compute a churn risk score (0-1) from engagement signals.
 * Higher = more at-risk.
 */
export function computeChurnScore(params: {
  daysSinceLastSession: number;
  recentSessionsPerWeek: number;
  previousSessionsPerWeek: number;
  recentAvgDuration: number;
  previousAvgDuration: number;
  uniqueEventTypes: number;
  totalEventTypes: number;
  accountAgeDays: number;
}): { score: number; factors: ChurnFactors } {
  // Days since last session: 0 days = 0 risk, 30+ days = 1.0 risk
  const daysFactor = Math.min(params.daysSinceLastSession / 30, 1.0);

  // Frequency trend: declining sessions per week
  const freqPrev = Math.max(params.previousSessionsPerWeek, 0.1);
  const freqRatio = params.recentSessionsPerWeek / freqPrev;
  const freqFactor = freqRatio >= 1 ? 0 : Math.min(1 - freqRatio, 1.0);

  // Duration trend: declining average session length
  const durPrev = Math.max(params.previousAvgDuration, 1);
  const durRatio = params.recentAvgDuration / durPrev;
  const durFactor = durRatio >= 1 ? 0 : Math.min(1 - durRatio, 1.0);

  // Engagement breadth: fewer unique event types = higher risk
  const totalTypes = Math.max(params.totalEventTypes, 1);
  const breadthFactor = 1 - Math.min(params.uniqueEventTypes / totalTypes, 1.0);

  // Account age: very new (<7d) or very old inactive accounts
  const ageFactor = params.accountAgeDays < 7 ? 0.5 : 0;

  const factors: ChurnFactors = {
    days_since_last: daysFactor,
    frequency_trend: freqFactor,
    duration_trend: durFactor,
    engagement_breadth: breadthFactor,
    account_age_risk: ageFactor,
  };

  const score =
    factors.days_since_last * CHURN_WEIGHTS.days_since_last +
    factors.frequency_trend * CHURN_WEIGHTS.frequency_trend +
    factors.duration_trend * CHURN_WEIGHTS.duration_trend +
    factors.engagement_breadth * CHURN_WEIGHTS.engagement_breadth +
    factors.account_age_risk * CHURN_WEIGHTS.account_age_risk;

  return { score: Math.min(Math.max(score, 0), 1), factors };
}

// ── Retention matrix: three PostHog modes ──

interface EventRecord {
  provider_user_id: string;
  timestamp: string;
}

/**
 * Compute cohort retention matrix.
 * Three modes following PostHog:
 *   first_time: cohort = first-ever start event
 *   recurring: cohort = every period with start event
 *   unbounded: retained if returned at any point after period
 */
export function computeRetentionMatrix(
  events: EventRecord[],
  mode: RetentionMode,
  periodUnit: "week" | "month",
  maxPeriods: number = 12,
): CohortRow[] {
  if (!events.length) return [];

  // Group events by user
  const userEvents: Record<string, Date[]> = {};
  for (const e of events) {
    if (!userEvents[e.provider_user_id]) userEvents[e.provider_user_id] = [];
    userEvents[e.provider_user_id].push(new Date(e.timestamp));
  }

  // Get period start for a date
  const getPeriodStart = (d: Date): Date => {
    const start = new Date(d);
    if (periodUnit === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
    } else {
      start.setDate(1);
    }
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const periodMs = periodUnit === "week" ? 7 * 86400000 : 30 * 86400000;

  // Get unique cohort periods
  const cohortMap = new Map<string, Set<string>>();
  const allUsersFirstPeriod = new Map<string, Date>();

  for (const [userId, dates] of Object.entries(userEvents)) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    const firstPeriod = getPeriodStart(dates[0]);
    allUsersFirstPeriod.set(userId, firstPeriod);

    if (mode === "first_time") {
      const key = firstPeriod.toISOString().slice(0, 10);
      if (!cohortMap.has(key)) cohortMap.set(key, new Set());
      cohortMap.get(key)!.add(userId);
    } else {
      // recurring: user appears in every period they were active
      const seenPeriods = new Set<string>();
      for (const d of dates) {
        const ps = getPeriodStart(d);
        const key = ps.toISOString().slice(0, 10);
        if (!seenPeriods.has(key)) {
          seenPeriods.add(key);
          if (!cohortMap.has(key)) cohortMap.set(key, new Set());
          cohortMap.get(key)!.add(userId);
        }
      }
    }
  }

  // Sort cohort dates
  const cohortDates = [...cohortMap.keys()].sort();
  const now = new Date();

  const rows: CohortRow[] = [];
  for (const cohortDate of cohortDates) {
    const cohortUsers = cohortMap.get(cohortDate)!;
    const cohortStart = new Date(cohortDate);
    const periods: { period: number; retained: number; rate: number }[] = [];

    for (let p = 0; p <= maxPeriods; p++) {
      const periodStart = new Date(cohortStart.getTime() + p * periodMs);
      const periodEnd = new Date(periodStart.getTime() + periodMs);

      if (periodStart > now) break;

      let retained = 0;
      for (const userId of cohortUsers) {
        const dates = userEvents[userId] || [];
        if (mode === "unbounded") {
          // Retained if returned at any point after this period
          const hasLater = dates.some((d) => d >= periodStart);
          if (hasLater) retained++;
        } else {
          // Retained if active in this specific period
          const activeInPeriod = dates.some((d) => d >= periodStart && d < periodEnd);
          if (activeInPeriod) retained++;
        }
      }

      const rate = cohortUsers.size > 0 ? retained / cohortUsers.size : 0;
      periods.push({ period: p, retained, rate });
    }

    rows.push({
      cohort_label: cohortDate,
      cohort_size: cohortUsers.size,
      retention_mode: mode,
      periods,
    });
  }

  return rows;
}

// ── Correlation analysis: PostHog pattern → RL feature engineering ──

/**
 * Compute correlation between event properties and retention.
 * For each property/value combination, calculate odds ratio:
 *   > 1 = predicts retention, < 1 = predicts churn
 * Properties with OR > 2.0 and p < 0.05 flagged as rl_feature_candidate.
 */
export function computeCorrelations(
  retainedUserIds: Set<string>,
  churnedUserIds: Set<string>,
  userProperties: Map<string, Record<string, string>>,
): CorrelationResult[] {
  const results: CorrelationResult[] = [];

  // Collect all property/value pairs
  const propValues = new Map<string, Set<string>>();
  for (const props of userProperties.values()) {
    for (const [key, val] of Object.entries(props)) {
      if (!propValues.has(key)) propValues.set(key, new Set());
      propValues.get(key)!.add(val);
    }
  }

  for (const [propName, values] of propValues) {
    for (const propValue of values) {
      // Count: retained users with/without property, churned with/without
      let retainedWith = 0, retainedWithout = 0;
      let churnedWith = 0, churnedWithout = 0;

      for (const uid of retainedUserIds) {
        const props = userProperties.get(uid);
        if (props?.[propName] === propValue) retainedWith++;
        else retainedWithout++;
      }
      for (const uid of churnedUserIds) {
        const props = userProperties.get(uid);
        if (props?.[propName] === propValue) churnedWith++;
        else churnedWithout++;
      }

      // Avoid division by zero with Haldane correction
      const a = retainedWith + 0.5;
      const b = retainedWithout + 0.5;
      const c = churnedWith + 0.5;
      const d = churnedWithout + 0.5;

      const oddsRatio = (a * d) / (b * c);
      const sampleSize = retainedWith + churnedWith;

      if (sampleSize < 5) continue;

      // Log odds ratio standard error for significance
      const logSE = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
      const z = Math.abs(Math.log(oddsRatio)) / logSE;
      // Two-tailed p-value approximation
      const pValue = 2 * (1 - normalCDF(z));

      const corrType = oddsRatio >= 1 ? "success" : "failure";
      const isCandidate = (oddsRatio >= 2.0 || oddsRatio <= 0.5) && pValue < 0.05;

      results.push({
        property_name: propName,
        property_value: propValue,
        correlation_type: corrType,
        odds_ratio: Math.round(oddsRatio * 100) / 100,
        significance: Math.round(pValue * 1000) / 1000,
        sample_size: sampleSize,
        rl_feature_candidate: isCandidate,
      });
    }
  }

  return results.sort((a, b) => Math.abs(Math.log(b.odds_ratio)) - Math.abs(Math.log(a.odds_ratio)));
}

// ── Winsorization: cap extreme values for stable RL reward signals ──

export function winsorize(values: number[], lower = 0.05, upper = 0.95): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[Math.floor(lower * sorted.length)];
  const hi = sorted[Math.floor(upper * sorted.length)];
  return values.map((v) => Math.max(lo, Math.min(hi, v)));
}

// ── Statistical testing ──

/**
 * Two-proportion z-test for A/B experiment significance.
 */
export function zTestTwoProportions(
  p1: number,
  n1: number,
  p2: number,
  n2: number,
): { z: number; pValue: number; significant: boolean } {
  if (n1 === 0 || n2 === 0) return { z: 0, pValue: 1, significant: false };
  const pPool = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, pValue: 1, significant: false };
  const z = (p1 - p2) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  return { z, pValue, significant: Math.abs(z) > 1.96 };
}

// Standard normal CDF approximation (Abramowitz and Stegun)
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  return 0.5 * (1.0 + sign * y);
}
