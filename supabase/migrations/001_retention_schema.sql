-- Retention schema for dedicated Supabase project (bsdltifbtadowlexhqry)
-- Run via Supabase SQL Editor or CLI

CREATE SCHEMA IF NOT EXISTS retention;

-- 1. Events: raw telemetry
CREATE TABLE IF NOT EXISTS retention.events (
  id          BIGSERIAL PRIMARY KEY,
  provider_user_id TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  properties  JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX idx_events_user    ON retention.events (provider_user_id);
CREATE INDEX idx_events_type    ON retention.events (event_type);
CREATE INDEX idx_events_ts      ON retention.events (timestamp DESC);

-- 2. Decisions: bandit actions chosen
CREATE TABLE IF NOT EXISTS retention.decisions (
  id                    TEXT PRIMARY KEY,
  provider_user_id      TEXT NOT NULL,
  action_chosen         TEXT NOT NULL,
  action_payload        JSONB DEFAULT '{}'::jsonb,
  context_features      JSONB DEFAULT '{}'::jsonb,
  policy_version        TEXT,
  exploration_probability DOUBLE PRECISION,
  was_exploration       BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decisions_user ON retention.decisions (provider_user_id);
CREATE INDEX idx_decisions_ts   ON retention.decisions (created_at DESC);

-- 3. Rewards: feedback signal per decision
CREATE TABLE IF NOT EXISTS retention.rewards (
  id            BIGSERIAL PRIMARY KEY,
  decision_id   TEXT NOT NULL REFERENCES retention.decisions(id),
  provider_user_id TEXT NOT NULL,
  reward_type   TEXT NOT NULL,
  reward_value  DOUBLE PRECISION NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rewards_decision ON retention.rewards (decision_id);
CREATE INDEX idx_rewards_user     ON retention.rewards (provider_user_id);

-- 4. Agent posteriors: Thompson sampling beta params
CREATE TABLE IF NOT EXISTS retention.agent_posteriors (
  id                BIGSERIAL PRIMARY KEY,
  provider_user_id  TEXT NOT NULL,
  dimension         TEXT NOT NULL,
  option            TEXT NOT NULL,
  alpha             DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  beta              DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  n_decisions       INTEGER NOT NULL DEFAULT 0,
  n_rewards         INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_user_id, dimension, option)
);
CREATE INDEX idx_posteriors_user ON retention.agent_posteriors (provider_user_id);

-- 5. Flag assignments: A/B test variant allocation
CREATE TABLE IF NOT EXISTS retention.flag_assignments (
  id                BIGSERIAL PRIMARY KEY,
  provider_user_id  TEXT NOT NULL,
  flag_name         TEXT NOT NULL,
  variant           TEXT NOT NULL,
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_user_id, flag_name)
);
CREATE INDEX idx_flags_user ON retention.flag_assignments (provider_user_id);
CREATE INDEX idx_flags_name ON retention.flag_assignments (flag_name);

-- 6. Control matches: incremental lift measurement
CREATE TABLE IF NOT EXISTS retention.control_matches (
  id                BIGSERIAL PRIMARY KEY,
  decision_id       TEXT NOT NULL UNIQUE REFERENCES retention.decisions(id),
  treated_user_id   TEXT NOT NULL,
  control_user_ids  TEXT[] DEFAULT '{}',
  match_criteria    JSONB DEFAULT '{}'::jsonb,
  treated_delta     DOUBLE PRECISION,
  control_delta     DOUBLE PRECISION,
  incremental_lift  DOUBLE PRECISION,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_control_decision ON retention.control_matches (decision_id);

-- 7. Policy config: versioned bandit configuration
CREATE TABLE IF NOT EXISTS retention.policy_config (
  id            BIGSERIAL PRIMARY KEY,
  version       TEXT NOT NULL UNIQUE,
  config_json   JSONB NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT false,
  published_by  TEXT,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes         TEXT DEFAULT ''
);
CREATE INDEX idx_config_active ON retention.policy_config (is_active) WHERE is_active = true;

-- Seed default policy config
INSERT INTO retention.policy_config (version, config_json, is_active, published_by, notes)
VALUES (
  'v1.0.0',
  '{
    "dimensions": {
      "timing": ["morning", "afternoon", "evening"],
      "channel": ["push", "email", "in_app"],
      "content_type": ["motivational", "progress", "social_proof", "tip"],
      "frequency": ["daily", "every_other_day", "weekly"]
    },
    "reward_weights": {
      "session_24h": 1.0,
      "session_72h": 0.5,
      "engagement": 0.3
    },
    "frequency_cap": 3,
    "cold_start_prior": { "alpha": 1.0, "beta": 1.0 },
    "attribution_window_hours": 72
  }',
  true,
  'system',
  'Default policy configuration'
)
ON CONFLICT (version) DO NOTHING;
