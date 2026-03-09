# Rumi Retention Dashboard — HogSpot Implementation Plan

> PostHog-grade analytics + RL-native surfaces + churn reduction tools
> Based on PostHog deep research + "The Metric That Changed Everything" article

---

## Architecture

```
Data Sources:
  Retention_Layer (bsdltifbtadowlexhqry)     Rumi_App (xdaxseboeioleiguqfkg)
  retention.events, decisions, rewards        session_evaluations, profiles
  retention.agent_posteriors, flag_assignments
  retention.control_matches, policy_config
  + 7 NEW analytics tables
         │                                           │
         ▼                                           ▼
  ┌──────────────────────────────────────────────────────────┐
  │              /api/cron/daily-metrics (2 AM)               │
  │  Sessions → APU → Lifecycle → Churn → Cohorts            │
  └────────────────────────┬─────────────────────────────────┘
                           ▼
  ┌──────────────────────────────────────────────────────────┐
  │              9 API routes → 8 dashboard pages             │
  └──────────────────────────────────────────────────────────┘
```

## Sidebar Navigation (12 items, 4 groups)

```
── Core ──
  Overview        /admin/retention
  RL Users        /admin/retention/users
  Segments        /admin/retention/segments
── Analytics ──
  APU / VIP       /admin/retention/apu
  Engagement      /admin/retention/engagement
  Lifecycle       /admin/retention/lifecycle
  Funnels         /admin/retention/funnels
── Churn ──
  Churn Risk      /admin/retention/churn
  Exit Forms      /admin/retention/exit-forms
  Experiments     /admin/retention/experiments
  Revenue         /admin/retention/revenue
── System ──
  Policy Config   /admin/retention/config
```

---

## Phase 0: Foundation ✅ COMPLETE

| # | File | Status |
|---|------|--------|
| 1 | `supabase/migrations/20260309000000_analytics_tables.sql` | ✅ Applied |
| 2 | `lib/supabase/rumi-app.ts` | ✅ Created |
| 3 | `lib/retention/types.ts` | ✅ Updated (20+ new types) |
| 4 | `lib/retention/analytics.ts` | ✅ Created |
| 5 | `components/charts/kpi-card.tsx` | ✅ Created |
| 6 | `components/charts/heatmap.tsx` | ✅ Created |
| 7 | `components/charts/funnel-chart.tsx` | ✅ Created |
| 8 | `components/charts/metric-card.tsx` | ✅ Created |
| 9 | `app/admin/layout.tsx` | ✅ Updated (4→12 nav items) |
| 10 | `middleware.ts` | ✅ Updated (/api/exit-form bypass) |
| 11 | `vercel.json` | ✅ Updated (daily-metrics cron) |

### New DB Tables (retention schema)

| Table | Purpose |
|-------|---------|
| `session_metrics` | Daily per-user session count + duration |
| `apu_snapshots` | Daily APU count, ratio, user IDs |
| `lifecycle_snapshots` | Four-state Markov: new/returning/resurrecting/dormant |
| `exit_forms` | Cancellation survey responses (7 reason categories) |
| `churn_risk_scores` | Multi-factor risk score (0-1) per user |
| `cohort_cache` | Precomputed retention matrix (3 PostHog modes) |
| `correlation_cache` | Event/property → retention correlation + RL feature flags |

---

## Phase 1: Core Engagement Metrics (Article's Leading Indicators)

### 1.1 — Daily Metrics Cron

| # | File | Status |
|---|------|--------|
| 1 | `app/api/cron/daily-metrics/route.ts` | ✅ Created |

Schedule: `0 2 * * *` (2 AM daily). Computes 5 aggregations:
1. **Session metrics** — per-user daily session count + duration
2. **APU snapshot** — paying users with 4+ sessions/week
3. **Lifecycle snapshot** — four-state classification per user
4. **Churn risk scores** — 5-factor weighted engagement decay
5. **Cohort cache** — weekly first_time retention matrix

### 1.2 — APU Dashboard (Active Paying Power Users)

| # | File | Status |
|---|------|--------|
| 2 | `app/api/admin/retention/apu/route.ts` | ✅ Created |
| 3 | `app/admin/retention/apu/page.tsx` | ✅ Created |

**Key metric from the article**: paying users who use the app 4+ times/week.
Trackable within 24-48 hours of any product change.

Page layout:
- KPI row: APU count, APU ratio, 48h trend, total paying
- AreaChart: daily APU count (30 days)
- APU user table: user ID, sessions/week, last session
- Health alerts: users who dropped below 4 sessions (were APU)

### 1.3 — Engagement Dashboard

| # | File | Status |
|---|------|--------|
| 4 | `app/api/admin/retention/engagement/route.ts` | ✅ Created |
| 5 | `app/admin/retention/engagement/page.tsx` | ✅ Created |

Three sections:
- **DAU/MAU ratio** — benchmark colors: green >20%, yellow 10-20%, red <10%
- **Session duration** — trend + red flag alert if avg drops >20% in 3 days
- **Stickiness** — histogram: days active per month vs user count

---

## Phase 2: Lifecycle & Cohort Analysis (PostHog Core)

| # | File | Status |
|---|------|--------|
| 1 | `app/api/admin/retention/lifecycle/route.ts` | ✅ Created |
| 2 | `app/admin/retention/lifecycle/page.tsx` | ✅ Created |
| 3 | `app/api/admin/retention/cohorts/route.ts` | ✅ Created |

### 2.1 — Lifecycle Analysis

PostHog's signature visualization — stacked BarChart of four lifecycle states.
- KPI row: New, Returning, Resurrecting, Dormant counts
- Stacked bar chart over time (7d/14d/30d/90d selector)
- RL Agent Activity Overlay: which lifecycle states the bandit targeted + transition success rates

### 2.2 — Cohort Retention Matrix

Three PostHog modes:
- **first_time**: cohort = first-ever event, classic product retention
- **recurring**: cohort = every active period, feature usage retention
- **unbounded**: retained at ANY point after = inverse of churn rate

Color-coded heatmap: green >50%, yellow 20-50%, red <20%.

---

## Phase 3: Churn Reduction Tools (Article + PostHog)

| # | File | Status |
|---|------|--------|
| 1 | `app/api/exit-form/route.ts` | ✅ Created |
| 2 | `app/api/admin/retention/exit-forms/route.ts` | ✅ Created |
| 3 | `app/admin/retention/exit-forms/page.tsx` | ✅ Created |
| 4 | `app/api/admin/retention/churn/route.ts` | ✅ Created |
| 5 | `app/admin/retention/churn/page.tsx` | ✅ Created |

### 3.1 — Exit/Cancellation Forms

From the article: "When someone tries to cancel, they need to answer one or two questions."

7 reason categories: too_expensive, not_useful, found_alternative, too_complex, missing_features, bugs, other.

Public POST endpoint (/api/exit-form) with API-key auth. Admin analytics page with:
- Reason distribution (horizontal BarChart)
- Submission trend (AreaChart)
- Recent entries table

### 3.2 — Churn Prediction & Risk Scoring

5-factor weighted scoring:
```
days_since_last_session  × 0.35
session_frequency_trend  × 0.25
session_duration_trend   × 0.15
engagement_breadth       × 0.15
account_age_risk         × 0.10
```

Risk distribution histogram + at-risk user table with RL intervention status.

### 3.3 — Correlation Analysis (PostHog → RL Feature Engineering)

Integrated into Churn page as a section. For each event property, computes odds ratio:
- `> 1` → predicts retention
- `< 1` → predicts churn
- `[RL]` badge on properties with OR > 2.0 and p < 0.05 (auto-added to RL state vector)

---

## Phase 4: Funnel Analysis

| # | File | Status |
|---|------|--------|
| 1 | `app/api/admin/retention/funnels/route.ts` | ✅ Created |
| 2 | `app/admin/retention/funnels/page.tsx` | ✅ Created |

Default funnel:
```
First Visit → Second Session (7d) → Weekly User (3+/wk) → Repeat Weekly → Power User (APU)
```

Side-by-side control vs treatment comparison using flag_assignments data.

---

## Phase 5: Experiments & Revenue

| # | File | Status |
|---|------|--------|
| 1 | `app/api/admin/retention/experiments/route.ts` | ✅ Created |
| 2 | `app/admin/retention/experiments/page.tsx` | ✅ Created |
| 3 | `app/api/admin/retention/revenue/route.ts` | ✅ Created |
| 4 | `app/admin/retention/revenue/page.tsx` | ✅ Created |

### 5.1 — A/B Test Results

Two-proportion z-test for significance. PostHog guardrail pattern:
- Primary metric: retention rate
- Guardrail metrics: session duration, engagement breadth
- RL Policy Impact: exploration rate convergence, Thompson Sampling vs baseline lift

### 5.2 — Revenue Analytics

MRR trend, churn rate, LTV, revenue at risk (from churn scoring).
Cross-project query to Rumi_App for subscription data.

---

## Dependency Graph

```
Phase 0 (Foundation) ✅
  ├──→ Phase 1 (APU + Engagement) ✅
  │       └──→ Phase 3 (Exit Forms + Churn) ✅
  │               └──→ Phase 5 (Experiments + Revenue) ✅
  ├──→ Phase 2 (Lifecycle + Cohorts) ✅
  └──→ Phase 4 (Funnels) ✅

Critical path: 0 → 1 → 3 → 5
Parallel paths: 2 and 4 (independent after Phase 0)
```

## Env Vars Required

```
# Already configured
NEXT_PUBLIC_SUPABASE_URL=https://bsdltifbtadowlexhqry.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...

# New for cross-project
RUMI_APP_SUPABASE_URL=https://xdaxseboeioleiguqfkg.supabase.co
RUMI_APP_SUPABASE_SERVICE_KEY=...

# Optional
PLAN_PRICE_MONTHLY=29
RETENTION_API_KEY=...
```

## What Makes This Different From PostHog

| PostHog (passive analytics) | Rumi Dashboard (active RL) |
|---|---|
| Shows lifecycle states | + which states RL agent targeted + transition success |
| Shows correlation analysis | + auto-flags high-signal properties as RL features |
| Shows A/B test results | + guardrails + policy convergence + Thompson vs baseline |
| Shows at-risk cohorts | + whether RL intervention already triggered |
| Shows retention matrix | + intervention density per cohort cell |
| Requires human interpretation | Closed-loop: signals → RL → reward → policy update |
