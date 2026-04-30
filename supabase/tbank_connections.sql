-- Run in Supabase SQL Editor to enable T-Bank Business API integration

CREATE TABLE IF NOT EXISTS tbank_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL UNIQUE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  expires_at      TIMESTAMPTZ,
  account_number  TEXT,
  company_name    TEXT,
  inn             TEXT,
  connected_at    TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Only the owner can see their connection
ALTER TABLE tbank_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tbank_connections' AND policyname = 'owner_only'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "owner_only"
        ON tbank_connections FOR ALL
        USING (user_id = auth.uid()::text)
    $p$;
  END IF;
END;
$$;
