-- Run in Supabase SQL Editor to enable Magic Link (email) authentication

CREATE TABLE IF NOT EXISTS magic_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No user-level access needed; accessed only via service role
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;
