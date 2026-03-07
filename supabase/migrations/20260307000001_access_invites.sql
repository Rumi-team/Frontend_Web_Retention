-- Access code gating: invite-based system with auto-generated codes
-- Each row = one invited person; code is auto-generated if not provided

CREATE TABLE IF NOT EXISTS public.access_codes (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT,                          -- invited person's name
  assigned_email TEXT,                          -- their email (optional, enforces match)
  code           TEXT NOT NULL UNIQUE DEFAULT   -- 8-char random uppercase code
                   upper(
                     substring(md5(random()::text || gen_random_uuid()::text), 1, 4) ||
                     substring(md5(random()::text || gen_random_uuid()::text), 1, 4)
                   ),
  max_uses       INTEGER DEFAULT 1,
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

-- Seed: Ali's invite code
INSERT INTO public.access_codes (name, assigned_email, code, max_uses, is_active)
VALUES ('Ali Naeini', 'ali@rumi.team', 'RUMI2026', 1, true)
ON CONFLICT (code) DO NOTHING;
