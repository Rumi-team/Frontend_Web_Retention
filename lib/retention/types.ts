// ── Existing types (RL core) ──

export interface PolicyConfig {
  version: string;
  config_json: {
    dimensions: Record<string, string[]>;
    reward_weights: Record<string, number>;
    frequency_cap: {
      max_per_week: number;
      cooldown_hours: number;
    };
    attribution_window_hours: number;
    cold_start_prior: {
      alpha: number;
      beta: number;
    };
  };
  published_by: string;
  published_at: string;
  is_active: boolean;
  notes: string;
}

export interface PosteriorEntry {
  alpha: number;
  beta: number;
  n_decisions: number;
  n_rewards: number;
}

export interface UserPosteriors {
  user_id: string;
  posteriors: Record<string, PosteriorEntry>;
  initialized: boolean;
}

export interface Segment {
  name: string;
  count: number;
  description: string;
}

export interface TimeSeries {
  decisions_by_day: Record<string, number>;
  rewards_by_day: Record<string, number>;
}

export interface RLHealth {
  cold_start_count: number;
  avg_incremental_lift: number;
}

export interface RetentionMetrics {
  total_decisions: number;
  total_events: number;
  total_rewards: number;
  action_distribution: Record<string, number>;
  avg_reward: number;
  exploration_rate: number;
  ab_split: Record<string, number>;
  time_series: TimeSeries;
  dimension_distributions: Record<string, Record<string, number>>;
  rl_health: RLHealth;
}

export interface RecentDecision {
  id: string;
  provider_user_id: string;
  action_chosen: string;
  action_payload: Record<string, string> | null;
  was_exploration: boolean;
  policy_version: string;
  created_at: string;
}

export interface UserRetentionDetail {
  user_id: string;
  segment: string;
  decision_count: number;
  last_contact: string | null;
  posteriors: Record<string, PosteriorEntry>;
  recent_decisions: RecentDecision[];
  recent_events: Array<{
    event_type: string;
    timestamp: string;
    properties: Record<string, unknown>;
  }>;
}

// ── APU (Active Paying Power Users) ──

export interface APUSnapshot {
  date: string;
  apu_count: number;
  total_paying: number;
  apu_ratio: number;
}

export interface APUUser {
  user_id: string;
  email?: string;
  name?: string;
  sessions_this_week: number;
  last_session: string;
  plan_type?: string;
}

// ── Engagement ──

export interface DAUMAURatio {
  date: string;
  dau: number;
  mau: number;
  ratio: number;
}

export interface SessionMetric {
  date: string;
  avg_duration_seconds: number;
  total_sessions: number;
  unique_users: number;
}

export interface StickinessPoint {
  days_active: number;
  user_count: number;
}

// ── Lifecycle (PostHog four-state Markov model) ──

export type LifecycleStage = "new" | "returning" | "resurrecting" | "dormant";

export interface LifecycleDay {
  date: string;
  new: number;
  returning: number;
  resurrecting: number;
  dormant: number;
}

// ── Cohort retention (three PostHog modes) ──

export type RetentionMode = "first_time" | "recurring" | "unbounded";

export interface CohortRow {
  cohort_label: string;
  cohort_size: number;
  retention_mode: RetentionMode;
  periods: { period: number; retained: number; rate: number }[];
}

// ── Exit forms ──

export interface ExitFormEntry {
  id: number;
  provider_user_id: string;
  reason_category: string;
  reason_detail: string;
  feedback: string;
  plan_at_exit: string;
  submitted_at: string;
}

export interface ExitReasonSummary {
  reason: string;
  count: number;
  percentage: number;
}

// ── Churn risk ──

export interface ChurnRiskUser {
  user_id: string;
  score: number;
  factors: Record<string, number>;
  last_session: string | null;
  computed_at: string;
}

// ── Correlation analysis (PostHog pattern → RL feature engineering) ──

export interface CorrelationResult {
  property_name: string;
  property_value: string;
  correlation_type: "success" | "failure";
  odds_ratio: number;
  significance: number;
  sample_size: number;
  rl_feature_candidate: boolean;
}

// ── Funnels ──

export interface FunnelStep {
  name: string;
  event_type: string;
  count: number;
  conversion_rate: number;
  drop_off: number;
}

export interface FunnelDefinition {
  name: string;
  steps: { label: string; event_type: string }[];
}

// ── Experiments (with PostHog guardrail pattern) ──

export interface GuardrailMetric {
  metric_name: string;
  control_value: number;
  treatment_value: number;
  degraded: boolean;
}

export interface ExperimentResult {
  flag_name: string;
  control_count: number;
  treatment_count: number;
  control_retention_rate: number;
  treatment_retention_rate: number;
  lift: number;
  confidence: number;
  is_significant: boolean;
  guardrails: GuardrailMetric[];
}

// ── Revenue ──

export interface RevenueMetrics {
  mrr: number;
  mrr_trend: { date: string; mrr: number }[];
  churn_rate: number;
  ltv_estimate: number;
  revenue_at_risk: number;
  total_customers: number;
}
