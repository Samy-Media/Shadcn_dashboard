-- People / public.users — align with app (run once: psql $DATABASE_URL -f this file)
BEGIN;

-- Legacy column name was safserv_active; app uses safeserv_active (SafeServ).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'safserv_active'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'safeserv_active'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN safserv_active TO safeserv_active;
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS atlas_last_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS safeserv_active BOOLEAN,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.users
SET
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;

-- Enforce NOT NULL slack_team_id (empty string if unknown)
UPDATE public.users SET slack_team_id = '' WHERE slack_team_id IS NULL;

ALTER TABLE public.users ALTER COLUMN slack_team_id SET NOT NULL;

-- requester_id as BIGINT when it is still text/varchar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'requester_id'
      AND data_type IN ('character varying', 'text', 'character')
  ) THEN
    ALTER TABLE public.users
      ALTER COLUMN requester_id TYPE BIGINT USING NULLIF(BTRIM(requester_id::text), '')::bigint;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
-- Use EXECUTE FUNCTION instead of PROCEDURE on PostgreSQL 14+
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_users_updated_at();

COMMIT;
