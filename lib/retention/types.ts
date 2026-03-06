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
