-- alert_history: stores dismissed / snoozed alerts per user
-- alert_type: 'cashgap' | 'anomaly'
-- alert_key: unique identifier within the type, e.g. "gap:2026-05-15:ФОТ"

CREATE TABLE IF NOT EXISTS alert_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  alert_type  TEXT        NOT NULL,
  alert_key   TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'dismissed', -- 'dismissed' | 'snoozed'
  snooze_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT alert_history_unique UNIQUE (user_id, alert_type, alert_key)
);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alerts"
  ON alert_history
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE INDEX IF NOT EXISTS alert_history_user_idx ON alert_history (user_id);
