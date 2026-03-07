-- Access code gating tables (same schema as Frontend_Web_App)
CREATE TABLE IF NOT EXISTS public.access_codes (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  assigned_email TEXT,
  max_uses       INTEGER,
  used_count     INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.access_code_redemptions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id    uuid NOT NULL REFERENCES public.access_codes(id),
  user_id    uuid NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Seed default access code
INSERT INTO public.access_codes (code, assigned_email, max_uses, is_active)
VALUES ('RUMI2026', 'ali@rumi.team', 1, true)
ON CONFLICT (code) DO NOTHING;
