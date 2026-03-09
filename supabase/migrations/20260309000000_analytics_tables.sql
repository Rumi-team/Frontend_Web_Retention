-- Analytics tables for retention dashboard expansion
-- 7 new tables in retention schema for PostHog-grade analytics + RL integration

-- 1. Session metrics: daily per-user aggregation
CREATE TABLE IF NOT EXISTS retention.session_metrics (
  id                    BIGSERIAL PRIMARY KEY,
  provider_user_id      TEXT NOT NULL,
  date                  DATE NOT NULL,
  session_count         INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  avg_duration_seconds  INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_session_metrics_user ON retention.session_metrics (provider_user_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_date ON retention.session_metrics (date DESC);

-- 2. APU snapshots: daily Active Paying Power Users count + ratio
CREATE TABLE IF NOT EXISTS retention.apu_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE NOT NULL UNIQUE,
  apu_count       INTEGER NOT NULL DEFAULT 0,
  total_paying    INTEGER NOT NULL DEFAULT 0,
  apu_ratio       DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  apu_user_ids    TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apu_date ON retention.apu_snapshots (date DESC);

-- 3. Lifecycle snapshots: four-state Markov classification (PostHog model)
--    Stages: new, returning, resurrecting, dormant
--    Each user's lifecycle state + transition history defines
--    the observation space for the RL policy network
CREATE TABLE IF NOT EXISTS retention.lifecycle_snapshots (
  id                BIGSERIAL PRIMARY KEY,
  provider_user_id  TEXT NOT NULL,
  date              DATE NOT NULL,
  stage             TEXT NOT NULL CHECK (stage IN ('new', 'returning', 'resurrecting', 'dormant')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_user  ON retention.lifecycle_snapshots (provider_user_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_date  ON retention.lifecycle_snapshots (date DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_stage ON retention.lifecycle_snapshots (stage);

-- 4. Exit forms: mandatory cancellation survey responses
CREATE TABLE IF NOT EXISTS retention.exit_forms (
  id                BIGSERIAL PRIMARY KEY,
  provider_user_id  TEXT NOT NULL,
  reason_category   TEXT NOT NULL CHECK (reason_category IN (
    'too_expensive', 'not_useful', 'found_alternative',
    'too_complex', 'missing_features', 'bugs', 'other'
  )),
  reason_detail     TEXT DEFAULT '',
  feedback          TEXT DEFAULT '',
  plan_at_exit      TEXT DEFAULT '',
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exit_user   ON retention.exit_forms (provider_user_id);
CREATE INDEX IF NOT EXISTS idx_exit_reason ON retention.exit_forms (reason_category);
CREATE INDEX IF NOT EXISTS idx_exit_time   ON retention.exit_forms (submitted_at DESC);

-- 5. Churn risk scores: multi-factor engagement decay (0.0 to 1.0)
CREATE TABLE IF NOT EXISTS retention.churn_risk_scores (
  id                BIGSERIAL PRIMARY KEY,
  provider_user_id  TEXT NOT NULL,
  score             DOUBLE PRECISION NOT NULL CHECK (score >= 0.0 AND score <= 1.0),
  factors           JSONB DEFAULT '{}'::jsonb,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_churn_user  ON retention.churn_risk_scores (provider_user_id);
CREATE INDEX IF NOT EXISTS idx_churn_score ON retention.churn_risk_scores (score DESC);

-- 6. Cohort cache: precomputed retention matrix
--    Supports PostHog's three modes: first_time, recurring, unbounded
CREATE TABLE IF NOT EXISTS retention.cohort_cache (
  id              BIGSERIAL PRIMARY KEY,
  cohort_date     DATE NOT NULL,
  period          INTEGER NOT NULL,
  period_unit     TEXT NOT NULL DEFAULT 'week' CHECK (period_unit IN ('day', 'week', 'month')),
  retention_mode  TEXT NOT NULL DEFAULT 'first_time' CHECK (retention_mode IN ('first_time', 'recurring', 'unbounded')),
  cohort_size     INTEGER NOT NULL DEFAULT 0,
  retained_count  INTEGER NOT NULL DEFAULT 0,
  retention_rate  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cohort_date, period, period_unit, retention_mode)
);
CREATE INDEX IF NOT EXISTS idx_cohort_date ON retention.cohort_cache (cohort_date);
CREATE INDEX IF NOT EXISTS idx_cohort_mode ON retention.cohort_cache (retention_mode);

-- 7. Correlation cache: which events/properties predict retention vs churn
--    PostHog's correlation analysis → automated RL feature engineering
CREATE TABLE IF NOT EXISTS retention.correlation_cache (
  id                BIGSERIAL PRIMARY KEY,
  property_name     TEXT NOT NULL,
  property_value    TEXT NOT NULL,
  correlation_type  TEXT NOT NULL CHECK (correlation_type IN ('success', 'failure')),
  odds_ratio        DOUBLE PRECISION NOT NULL,
  significance      DOUBLE PRECISION NOT NULL,
  sample_size       INTEGER NOT NULL DEFAULT 0,
  rl_feature_candidate BOOLEAN NOT NULL DEFAULT false,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_name, property_value, correlation_type)
);
CREATE INDEX IF NOT EXISTS idx_corr_type   ON retention.correlation_cache (correlation_type);
CREATE INDEX IF NOT EXISTS idx_corr_rl     ON retention.correlation_cache (rl_feature_candidate) WHERE rl_feature_candidate = true;
