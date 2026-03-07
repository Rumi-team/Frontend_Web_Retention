-- Access invites table: controls who can access the dashboard
CREATE TABLE IF NOT EXISTS public.access_invites (
  email       TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed admin access
INSERT INTO public.access_invites (email, code)
VALUES ('ali@rumi.team', 'RUMI2026')
ON CONFLICT (email) DO NOTHING;
