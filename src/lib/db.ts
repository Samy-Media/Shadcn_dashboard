import { Pool, type PoolClient } from "pg";

const rawPrefix = process.env.DB_PREFIX ?? "";

export const DB_TABLES = {
  slackInstallation: `${rawPrefix}slack_installation`,
  users: `${rawPrefix}users`,
  jobs: `${rawPrefix}jobs`,
  slackMessageJobs: `${rawPrefix}slack_message_jobs`,
  slackAtlasSyncJobs: `${rawPrefix}slack_atlas_sync_jobs`,
  freshserviceTickets: `${rawPrefix}freshservice_tickets`,
  employeesDirectory: `${rawPrefix}employees_directory`,
} as const;

const connectionString =
  process.env.DATABASE_URL ?? process.env.databaseURL;

/** Keep low so small hosted Postgres tiers (strict per-role limits) are not exhausted. */
const poolMax = (() => {
  const raw = process.env.PG_POOL_MAX;
  if (raw === undefined || raw === "") return 4;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 4;
})();

/** Unqualified table name for `information_schema` (no schema prefix). */
function tableName(qualified: string): string {
  const parts = qualified.split(".");
  return parts[parts.length - 1] ?? qualified;
}

export const pool = new Pool({
  connectionString,
  max: poolMax,
  ssl: connectionString
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

export default pool;

export async function connectDB(): Promise<void> {
  let client: PoolClient | null = null;
  const usersTable = tableName(DB_TABLES.users);
  const slackInstTable = tableName(DB_TABLES.slackInstallation);

  try {
    client = await pool.connect();
    console.log("Connected to DB successfully");

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.slackInstallation} (
        id BIGSERIAL PRIMARY KEY,
        slack_team_id TEXT NOT NULL,
        team_name TEXT,
        enterprise_id TEXT,
        enterprise_name TEXT,
        user_id TEXT,
        bot_token TEXT,
        bot_id TEXT,
        scopes TEXT,
        installation JSONB NOT NULL,
        app_name TEXT NOT NULL,
        app_id TEXT,
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (slack_team_id, app_name)
      );
    `);

    await client.query(`
      DO $migrate$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '${slackInstTable}'
        )
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${slackInstTable}' AND column_name = 'id'
        ) THEN
          ALTER TABLE ${DB_TABLES.slackInstallation} DROP CONSTRAINT IF EXISTS slack_installation_pkey;
          ALTER TABLE ${DB_TABLES.slackInstallation} ADD COLUMN id BIGSERIAL PRIMARY KEY;
          ALTER TABLE ${DB_TABLES.slackInstallation} ADD COLUMN app_name TEXT;
          UPDATE ${DB_TABLES.slackInstallation} SET app_name = 'default' WHERE app_name IS NULL;
          ALTER TABLE ${DB_TABLES.slackInstallation} ALTER COLUMN app_name SET NOT NULL;
          CREATE UNIQUE INDEX IF NOT EXISTS uq_slack_installation_team_app
            ON ${DB_TABLES.slackInstallation} (slack_team_id, app_name);
        END IF;
      END
      $migrate$;
    `);

    const appName = process.env.SLACK_APP_NAME?.trim() || "default";
    await client.query(
      `UPDATE ${DB_TABLES.slackInstallation} SET app_name = $1 WHERE app_name = 'default'`,
      [appName],
    );

    await client.query(
      `ALTER TABLE ${DB_TABLES.slackInstallation} ADD COLUMN IF NOT EXISTS app_id TEXT`,
    );
    const appId = process.env.SLACK_APP_ID?.trim();
    if (appId) {
      await client.query(
        `UPDATE ${DB_TABLES.slackInstallation} SET app_id = $1 WHERE app_id IS NULL`,
        [appId],
      );
    }

    await client.query(
      `ALTER TABLE ${DB_TABLES.slackInstallation} ADD COLUMN IF NOT EXISTS app_base_url TEXT`,
    );
    await client.query(
      `ALTER TABLE ${DB_TABLES.slackInstallation} ADD COLUMN IF NOT EXISTS redirect_uri TEXT`,
    );
    const si = DB_TABLES.slackInstallation;
    const siName = slackInstTable;
    await client.query(`
      DO $migrate$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${siName}'
            AND column_name = 'safeserv_slack_app_base_url'
        ) THEN
          UPDATE ${si}
          SET app_base_url = COALESCE(app_base_url, safeserv_slack_app_base_url);
          ALTER TABLE ${si} DROP COLUMN safeserv_slack_app_base_url;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${siName}'
            AND column_name = 'safeserv_slack_redirect_uri'
        ) THEN
          UPDATE ${si}
          SET redirect_uri = COALESCE(redirect_uri, safeserv_slack_redirect_uri);
          ALTER TABLE ${si} DROP COLUMN safeserv_slack_redirect_uri;
        END IF;
      END
      $migrate$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.users} (
        slack_user_id TEXT NOT NULL,
        slack_team_id TEXT NOT NULL,
        email TEXT,
        requester_id BIGINT,
        atlas_last_sync TIMESTAMPTZ,
        digispace_active BOOLEAN,
        agent_requester_id BIGINT,
        "isAgent" BOOLEAN,
        safeserv_active BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (slack_user_id, slack_team_id)
      );
    `);

    await client.query(`
      ALTER TABLE ${DB_TABLES.users} ADD COLUMN IF NOT EXISTS email TEXT;
    `);
    await client.query(`
      ALTER TABLE ${DB_TABLES.users} ADD COLUMN IF NOT EXISTS requester_id BIGINT;
    `);
    await client.query(`
      ALTER TABLE ${DB_TABLES.users} ADD COLUMN IF NOT EXISTS safeserv_active BOOLEAN;
    `);
    await client.query(`
      ALTER TABLE ${DB_TABLES.users} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    `);
    await client.query(`
      ALTER TABLE ${DB_TABLES.users} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);
    await client.query(`
      ALTER TABLE ${DB_TABLES.users} ADD COLUMN IF NOT EXISTS atlas_last_sync TIMESTAMPTZ;
    `);
    await client.query(`
      ALTER TABLE ${DB_TABLES.users} ADD COLUMN IF NOT EXISTS digispace_active BOOLEAN;
    `);
    await client.query(`
      DO $migrate$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${usersTable}' AND column_name = 'agent_requeser_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${usersTable}' AND column_name = 'agent_requester_id'
        ) THEN
          ALTER TABLE ${DB_TABLES.users} RENAME COLUMN agent_requeser_id TO agent_requester_id;
        END IF;
      END
      $migrate$;
    `);
    await client.query(`
      ALTER TABLE ${DB_TABLES.users} ADD COLUMN IF NOT EXISTS agent_requester_id BIGINT;
    `);
    await client.query(`
      ALTER TABLE ${DB_TABLES.users} ADD COLUMN IF NOT EXISTS "isAgent" BOOLEAN;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.jobs} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bull_job_id TEXT,
        job_type TEXT NOT NULL,
        slack_user_ids TEXT[] NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        result JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.slackMessageJobs} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bull_job_id TEXT,
        channel TEXT NOT NULL,
        message_text TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        result JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.slackAtlasSyncJobs} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bull_job_id TEXT,
        slack_user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.freshserviceTickets} (
        fs_ticket_id BIGINT PRIMARY KEY,
        subject TEXT,
        group_id BIGINT,
        department_id BIGINT,
        category TEXT,
        sub_category TEXT,
        item_category TEXT,
        requester_id BIGINT,
        responder_id BIGINT,
        due_by TIMESTAMPTZ,
        fr_escalated BOOLEAN NOT NULL DEFAULT false,
        deleted BOOLEAN NOT NULL DEFAULT false,
        spam BOOLEAN NOT NULL DEFAULT false,
        email_config_id BIGINT,
        fwd_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
        reply_cc_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
        cc_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_escalated BOOLEAN NOT NULL DEFAULT false,
        fr_due_by TIMESTAMPTZ,
        priority TEXT,
        source INTEGER,
        status TEXT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        workspace_id INTEGER,
        requested_for_id BIGINT,
        to_emails JSONB,
        ticket_type TEXT,
        description TEXT,
        description_text TEXT,
        custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
        destination_location TEXT,
        waybill_status TEXT,
        sla_priority TEXT,
        business_rule TEXT,
        impact INTEGER,
        urgency INTEGER,
        created_by BIGINT,
        sla_policy_id BIGINT,
        approval_status TEXT,
        approval_status_name TEXT,
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        synced_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const ft = DB_TABLES.freshserviceTickets;
    const ftName = tableName(ft);
    await client.query(`
      DO $migrate$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${ftName}'
            AND column_name = 'priority'
            AND data_type = 'integer'
        ) THEN
          ALTER TABLE ${ft} ALTER COLUMN priority TYPE TEXT USING priority::text;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${ftName}'
            AND column_name = 'status'
            AND data_type = 'integer'
        ) THEN
          ALTER TABLE ${ft} ALTER COLUMN status TYPE TEXT USING status::text;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${ftName}'
            AND column_name = 'impact'
        ) THEN
          ALTER TABLE ${ft} ADD COLUMN impact INTEGER;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${ftName}'
            AND column_name = 'urgency'
        ) THEN
          ALTER TABLE ${ft} ADD COLUMN urgency INTEGER;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${ftName}'
            AND column_name = 'created_by'
        ) THEN
          ALTER TABLE ${ft} ADD COLUMN created_by BIGINT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${ftName}'
            AND column_name = 'sla_policy_id'
        ) THEN
          ALTER TABLE ${ft} ADD COLUMN sla_policy_id BIGINT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${ftName}'
            AND column_name = 'approval_status'
        ) THEN
          ALTER TABLE ${ft} ADD COLUMN approval_status TEXT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${ftName}'
            AND column_name = 'approval_status_name'
        ) THEN
          ALTER TABLE ${ft} ADD COLUMN approval_status_name TEXT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${ftName}'
            AND column_name = 'attachments'
        ) THEN
          ALTER TABLE ${ft} ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
        END IF;
      END
      $migrate$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${DB_TABLES.employeesDirectory} (
        "login" TEXT,
        "email" TEXT,
        "employeeCode" TEXT PRIMARY KEY,
        "firstName" TEXT,
        "mobile" TEXT,
        "mobile2" TEXT,
        "mobileNo" TEXT,
        "designation" TEXT,
        "city" TEXT,
        "state" TEXT,
        "brCode" TEXT,
        "brName" TEXT,
        "regionCd" TEXT,
        "region" TEXT,
        "status" TEXT,
        "departName" TEXT,
        "toReporting" TEXT,
        "reportingMail" TEXT,
        "reporting_code" TEXT,
        "location" TEXT
      );
    `);

    console.log(
      `Tables verified: ${DB_TABLES.slackInstallation}, ${DB_TABLES.users}, ${DB_TABLES.jobs}, ${DB_TABLES.slackMessageJobs}, ${DB_TABLES.slackAtlasSyncJobs}, ${DB_TABLES.freshserviceTickets}, ${DB_TABLES.employeesDirectory}`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DB connection failed:", message);
    process.exit(1);
  } finally {
    client?.release();
  }
}
