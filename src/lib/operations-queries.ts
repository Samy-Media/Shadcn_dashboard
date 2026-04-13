import type { QueryResultRow } from "pg";
import pool from "@/lib/db";

export type UserRow = {
  slack_user_id: string;
  slack_team_id: string;
  email: string | null;
  /** BIGINT from Postgres (node-pg may return string) */
  requester_id: string | null;
  /** SafeServ enrollment flag (`safeserv_active` in Postgres). */
  safeserv_active: boolean | null;
  digispace_active: boolean | null;
  /** Slack / agent automation flag (column is quoted "isAgent" in Postgres). */
  is_agent: boolean | null;
  agent_requester_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  atlas_last_sync: string | null;
};

export type JobRow = {
  id: string;
  bull_job_id: string | null;
  job_type: string;
  slack_user_ids: string[];
  status: string;
  result: unknown;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SlackInstallationRow = {
  slack_team_id: string;
  team_name: string | null;
  app_name: string | null;
  app_id: string | null;
  enterprise_id: string | null;
  enterprise_name: string | null;
  user_id: string | null;
  bot_id: string | null;
  scopes: string | null;
  /** App origin; Health tab probes app_base_url + /health. */
  app_base_url: string | null;
  installed_at: string | null;
  updated_at: string | null;
};

/** Daily buckets over the last 7 days; counts jobs by creation time and current status. */
export type JobStatusBucket7d = {
  bucket: string;
  completed: number;
  failed: number;
  queued: number;
  jobs: number;
  messages: number;
  atlas: number;
};

export type DashboardStats = {
  usersOnboarded: number;
  slackInstallations: number;
  activeSessions: number;
  jobs: {
    total: number;
    queued: number;
    failed: number;
    completed: number;
  };
  jobsLast7d: JobStatusBucket7d[];
};

const JOB_STATUS_RANGE_DAYS = 7;

/** Jobs created each day over the last 7 days, grouped by the same status rules as dashboard totals. */
export async function getJobsStatusBucketsLast7Days(): Promise<
  JobStatusBucket7d[]
> {
  const { rows } = await pool.query<{
    bucket_at: Date;
    completed: string;
    failed: string;
    queued: string;
    jobs: string;
    messages: string;
    atlas: string;
  }>(
    `WITH all_jobs AS (
       SELECT created_at, status, 'jobs'::text AS source
       FROM public.jobs
       WHERE created_at IS NOT NULL
       UNION ALL
       SELECT created_at, status, 'messages'::text AS source
       FROM public.slack_message_jobs
       WHERE created_at IS NOT NULL
       UNION ALL
       SELECT created_at, status, 'atlas'::text AS source
       FROM public.slack_atlas_sync_jobs
       WHERE created_at IS NOT NULL
     )
     SELECT
       date_trunc('day', created_at) AS bucket_at,
       COUNT(*) FILTER (
         WHERE LOWER(TRIM(status)) IN (
           'completed', 'success', 'succeeded', 'complete'
         )
       )::text AS completed,
       COUNT(*) FILTER (
         WHERE LOWER(TRIM(status)) IN (
           'failed', 'failure', 'error', 'errored'
         )
       )::text AS failed,
       COUNT(*) FILTER (
         WHERE LOWER(TRIM(status)) NOT IN (
           'completed', 'success', 'succeeded', 'complete',
           'failed', 'failure', 'error', 'errored'
         )
       )::text AS queued,
       COUNT(*) FILTER (WHERE source = 'jobs')::text AS jobs,
       COUNT(*) FILTER (WHERE source = 'messages')::text AS messages,
       COUNT(*) FILTER (WHERE source = 'atlas')::text AS atlas
     FROM all_jobs
     WHERE created_at >= date_trunc('day', NOW()) - INTERVAL '6 days'
     GROUP BY 1
     ORDER BY 1`
  );

  const rowMap = new Map<
    string,
    {
      completed: number;
      failed: number;
      queued: number;
      jobs: number;
      messages: number;
      atlas: number;
    }
  >();

  for (const r of rows) {
    const bucketDate = new Date(r.bucket_at);
    const aligned = new Date(
      bucketDate.getFullYear(),
      bucketDate.getMonth(),
      bucketDate.getDate()
    );
    rowMap.set(aligned.toISOString(), {
      completed: Number(r.completed ?? 0),
      failed: Number(r.failed ?? 0),
      queued: Number(r.queued ?? 0),
      jobs: Number(r.jobs ?? 0),
      messages: Number(r.messages ?? 0),
      atlas: Number(r.atlas ?? 0),
    });
  }

  const today = new Date();
  const endBucket = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const out: JobStatusBucket7d[] = [];

  for (let i = JOB_STATUS_RANGE_DAYS - 1; i >= 0; i--) {
    const t = new Date(endBucket);
    t.setDate(endBucket.getDate() - i);
    const key = t.toISOString();
    const m = rowMap.get(key);
    out.push({
      bucket: key,
      completed: m?.completed ?? 0,
      failed: m?.failed ?? 0,
      queued: m?.queued ?? 0,
      jobs: m?.jobs ?? 0,
      messages: m?.messages ?? 0,
      atlas: m?.atlas ?? 0,
    });
  }

  return out;
}

function toBigintString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function toBoolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

function toUserRow(r: QueryResultRow): UserRow {
  return {
    slack_user_id: r.slack_user_id,
    slack_team_id: r.slack_team_id ?? "",
    email: r.email ?? null,
    requester_id:
      r.requester_id === null || r.requester_id === undefined
        ? null
        : String(r.requester_id),
    safeserv_active:
      r.safeserv_active === null || r.safeserv_active === undefined
        ? null
        : Boolean(r.safeserv_active),
    digispace_active: toBoolOrNull(r.digispace_active),
    is_agent: toBoolOrNull(r.is_agent),
    agent_requester_id: toBigintString(r.agent_requester_id),
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
    atlas_last_sync: r.atlas_last_sync ?? null,
  };
}

function toJobRow(r: QueryResultRow): JobRow {
  return {
    id: r.id,
    bull_job_id: r.bull_job_id ?? null,
    job_type: r.job_type,
    slack_user_ids: Array.isArray(r.slack_user_ids) ? r.slack_user_ids : [],
    status: r.status,
    result: r.result ?? null,
    error_message: r.error_message ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

function toSlackInstallationRow(r: QueryResultRow): SlackInstallationRow {
  return {
    slack_team_id: r.slack_team_id,
    team_name: r.team_name ?? null,
    app_name:
      r.app_name === null || r.app_name === undefined
        ? null
        : String(r.app_name).trim() || null,
    app_id:
      r.app_id === null || r.app_id === undefined
        ? null
        : String(r.app_id).trim() || null,
    enterprise_id: r.enterprise_id ?? null,
    enterprise_name: r.enterprise_name ?? null,
    user_id: r.user_id ?? null,
    bot_id: r.bot_id ?? null,
    scopes: r.scopes ?? null,
    app_base_url:
      r.app_base_url === null || r.app_base_url === undefined
        ? null
        : String(r.app_base_url).trim() || null,
    installed_at: r.installed_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

const USERS_SELECT = `SELECT slack_user_id, slack_team_id, email, requester_id, safeserv_active,
       digispace_active, "isAgent" AS is_agent, agent_requester_id,
       created_at, updated_at, atlas_last_sync
     FROM public.users`;

export async function listUsers(): Promise<UserRow[]> {
  const { rows } = await pool.query(
    `${USERS_SELECT}
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, slack_user_id ASC`
  );
  return rows.map(toUserRow);
}

/** Whitelist for ORDER BY (avoid dynamic SQL injection). */
export type UserListSort =
  | "updated_at_desc"
  | "updated_at_asc"
  | "created_at_desc"
  | "created_at_asc";

export function parseUserListSort(raw: string | undefined): UserListSort | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (
    s === "updated_at_desc" ||
    s === "updated_at_asc" ||
    s === "created_at_desc" ||
    s === "created_at_asc"
  ) {
    return s;
  }
  return undefined;
}

function userListOrderBy(sort: UserListSort | undefined): string {
  switch (sort) {
    case "updated_at_asc":
      return "updated_at ASC NULLS LAST, slack_user_id ASC";
    case "created_at_desc":
      return "created_at DESC NULLS LAST, slack_user_id ASC";
    case "created_at_asc":
      return "created_at ASC NULLS LAST, slack_user_id ASC";
    case "updated_at_desc":
    default:
      return "updated_at DESC NULLS LAST, created_at DESC NULLS LAST, slack_user_id ASC";
  }
}

export type UserListFilters = {
  limit: number;
  offset: number;
  /** Search slack_user_id, email, slack_team_id, requester_id */
  q?: string;
  slackUserId?: string;
  requesterIdContains?: string;
  hasEmail?: boolean;
  /** true = safeserv_active IS TRUE; false = IS NOT TRUE */
  safeservActive?: boolean;
  /** true = digispace_active IS TRUE; false = IS NOT TRUE */
  digispaceActive?: boolean;
  /** true = "isAgent" IS TRUE; false = IS NOT TRUE */
  isAgent?: boolean;
  sort?: UserListSort;
};

function buildUserWhere(f: UserListFilters): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (f.slackUserId?.trim()) {
    parts.push(`slack_user_id = $${i}`);
    params.push(f.slackUserId.trim());
    i++;
  }
  if (f.requesterIdContains?.trim()) {
    parts.push(`COALESCE(requester_id::text, '') ILIKE $${i}`);
    params.push(`%${f.requesterIdContains.trim()}%`);
    i++;
  }
  if (f.hasEmail === true) {
    parts.push(`(email IS NOT NULL AND BTRIM(COALESCE(email, '')) <> '')`);
  } else if (f.hasEmail === false) {
    parts.push(`(email IS NULL OR BTRIM(COALESCE(email, '')) = '')`);
  }
  if (f.safeservActive === true) {
    parts.push(`safeserv_active IS TRUE`);
  } else if (f.safeservActive === false) {
    parts.push(`safeserv_active IS NOT TRUE`);
  }
  if (f.digispaceActive === true) {
    parts.push(`digispace_active IS TRUE`);
  } else if (f.digispaceActive === false) {
    parts.push(`digispace_active IS NOT TRUE`);
  }
  if (f.isAgent === true) {
    parts.push(`"isAgent" IS TRUE`);
  } else if (f.isAgent === false) {
    parts.push(`"isAgent" IS NOT TRUE`);
  }
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    parts.push(`(
      slack_user_id ILIKE $${i}
      OR COALESCE(email, '') ILIKE $${i}
      OR COALESCE(slack_team_id, '') ILIKE $${i}
      OR COALESCE(requester_id::text, '') ILIKE $${i}
      OR COALESCE(agent_requester_id::text, '') ILIKE $${i}
    )`);
    params.push(q);
    i++;
  }

  const sql = parts.length ? parts.join(" AND ") : "TRUE";
  return { sql, params };
}

export async function listUsersFiltered(
  filters: UserListFilters
): Promise<{ rows: UserRow[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit, 1), 500);
  const offset = Math.max(filters.offset, 0);
  const { sql: whereSql, params: baseParams } = buildUserWhere(filters);
  const order = userListOrderBy(filters.sort);

  const countRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM public.users WHERE ${whereSql}`,
    baseParams
  );
  const total = Number(countRes.rows[0]?.c ?? 0);

  const limIdx = baseParams.length + 1;
  const offIdx = baseParams.length + 2;
  const dataSql = `${USERS_SELECT} WHERE ${whereSql} ORDER BY ${order} LIMIT $${limIdx}::int OFFSET $${offIdx}::int`;
  const { rows } = await pool.query(dataSql, [...baseParams, limit, offset]);
  return { rows: rows.map(toUserRow), total };
}

export async function getUserBySlackId(
  slackUserId: string
): Promise<UserRow | null> {
  if (!slackUserId.trim()) return null;
  const { rows } = await pool.query(`${USERS_SELECT} WHERE slack_user_id = $1`, [
    slackUserId.trim(),
  ]);
  if (rows.length === 0) return null;
  return toUserRow(rows[0]);
}

/** Prefer this when the composite key (slack_user_id, slack_team_id) is known. */
export async function getUserByCompositeKey(
  slackUserId: string,
  slackTeamId: string
): Promise<UserRow | null> {
  const u = slackUserId.trim();
  const t = slackTeamId.trim();
  if (!u || !t) return null;
  const { rows } = await pool.query(
    `${USERS_SELECT} WHERE slack_user_id = $1 AND slack_team_id = $2`,
    [u, t]
  );
  if (rows.length === 0) return null;
  return toUserRow(rows[0]);
}

/** Writable fields for dashboard People detail (maps to public.users). */
export type UserEditableFields = {
  email: string | null;
  requester_id: string | null;
  is_agent: boolean;
  agent_requester_id: string | null;
};

const USERS_RETURNING = `RETURNING slack_user_id, slack_team_id, email, requester_id, safeserv_active,
       digispace_active, "isAgent" AS is_agent, agent_requester_id,
       created_at, updated_at, atlas_last_sync`;

export async function updateUserByCompositeKey(
  slackUserId: string,
  slackTeamId: string,
  patch: UserEditableFields
): Promise<UserRow | null> {
  const u = slackUserId.trim();
  const t = slackTeamId.trim();
  if (!u || !t) return null;

  const email =
    patch.email !== null && patch.email !== undefined && patch.email.trim() !== ""
      ? patch.email.trim()
      : null;

  const reqRaw = patch.requester_id?.trim() ?? "";
  const requester_id: string | null = reqRaw === "" ? null : reqRaw;

  const agentRaw = patch.agent_requester_id?.trim() ?? "";
  const agent_requester_id: string | null = agentRaw === "" ? null : agentRaw;

  const { rows } = await pool.query(
    `UPDATE public.users SET
       email = $3,
       requester_id = CASE WHEN $4::text IS NULL OR BTRIM($4::text) = '' THEN NULL ELSE $4::bigint END,
       "isAgent" = $5,
       agent_requester_id = CASE WHEN $6::text IS NULL OR BTRIM($6::text) = '' THEN NULL ELSE $6::bigint END,
       updated_at = NOW()
     WHERE slack_user_id = $1 AND slack_team_id = $2
     ${USERS_RETURNING}`,
    [u, t, email, requester_id, patch.is_agent, agent_requester_id]
  );
  if (rows.length === 0) return null;
  return toUserRow(rows[0]);
}

export type JobSort =
  | "created_at_desc"
  | "created_at_asc"
  | "updated_at_desc"
  | "updated_at_asc";

export type JobListFilters = {
  limit: number;
  offset: number;
  sort: JobSort;
  /** Exact status match (lowercase) — one or more */
  statusIn?: string[];
  /** Bucket when statusIn not set */
  statusGroup?: "completed" | "failed" | "queued";
  jobTypeContains?: string;
  bullJobIdContains?: string;
  slackUserId?: string;
  /** Search job_type, status, bull_job_id, error_message, id, slack_user_ids */
  q?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  hasError?: boolean;
};

const JOB_SELECT = `SELECT id, bull_job_id, job_type, slack_user_ids, status, result, error_message, created_at, updated_at
     FROM public.jobs`;

function jobOrderClause(sort: JobSort): string {
  switch (sort) {
    case "created_at_asc":
      return "created_at ASC NULLS LAST, id ASC";
    case "updated_at_desc":
      return "updated_at DESC NULLS LAST, id DESC";
    case "updated_at_asc":
      return "updated_at ASC NULLS LAST, id ASC";
    default:
      return "created_at DESC NULLS LAST, id DESC";
  }
}

function buildJobWhere(f: JobListFilters): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (f.statusIn && f.statusIn.length > 0) {
    const cleaned = f.statusIn
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (cleaned.length) {
      parts.push(`LOWER(TRIM(status)) = ANY($${i}::text[])`);
      params.push(cleaned);
      i++;
    }
  } else if (f.statusGroup === "completed") {
    parts.push(
      `(LOWER(TRIM(status)) IN ('completed','success','succeeded','complete'))`
    );
  } else if (f.statusGroup === "failed") {
    parts.push(
      `(LOWER(TRIM(status)) IN ('failed','failure','error','errored'))`
    );
  } else if (f.statusGroup === "queued") {
    parts.push(`(LOWER(TRIM(status)) NOT IN (
      'completed','success','succeeded','complete',
      'failed','failure','error','errored'
    ))`);
  }

  if (f.jobTypeContains?.trim()) {
    parts.push(`job_type ILIKE $${i}`);
    params.push(`%${f.jobTypeContains.trim()}%`);
    i++;
  }
  if (f.bullJobIdContains?.trim()) {
    parts.push(`COALESCE(bull_job_id,'') ILIKE $${i}`);
    params.push(`%${f.bullJobIdContains.trim()}%`);
    i++;
  }
  if (f.slackUserId?.trim()) {
    parts.push(`$${i} = ANY(slack_user_ids)`);
    params.push(f.slackUserId.trim());
    i++;
  }
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    parts.push(`(
      job_type ILIKE $${i}
      OR LOWER(TRIM(status)) ILIKE LOWER($${i})
      OR COALESCE(bull_job_id,'') ILIKE $${i}
      OR COALESCE(error_message,'') ILIKE $${i}
      OR id::text ILIKE $${i}
      OR EXISTS (SELECT 1 FROM unnest(slack_user_ids) AS u WHERE u::text ILIKE $${i})
    )`);
    params.push(q);
    i++;
  }
  if (f.createdFrom) {
    parts.push(`created_at >= $${i}::timestamptz`);
    params.push(f.createdFrom);
    i++;
  }
  if (f.createdTo) {
    parts.push(`created_at <= $${i}::timestamptz`);
    params.push(f.createdTo);
    i++;
  }
  if (f.updatedFrom) {
    parts.push(`updated_at >= $${i}::timestamptz`);
    params.push(f.updatedFrom);
    i++;
  }
  if (f.updatedTo) {
    parts.push(`updated_at <= $${i}::timestamptz`);
    params.push(f.updatedTo);
    i++;
  }
  if (f.hasError === true) {
    parts.push(`error_message IS NOT NULL AND TRIM(error_message) <> ''`);
  } else if (f.hasError === false) {
    parts.push(`(error_message IS NULL OR TRIM(error_message) = '')`);
  }

  const sql = parts.length ? parts.join(" AND ") : "TRUE";
  return { sql, params };
}

export async function listJobsFiltered(
  filters: JobListFilters
): Promise<{ rows: JobRow[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit, 1), 500);
  const offset = Math.max(filters.offset, 0);
  const { sql: whereSql, params: baseParams } = buildJobWhere(filters);
  const order = jobOrderClause(filters.sort);

  const countRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM public.jobs WHERE ${whereSql}`,
    baseParams
  );
  const total = Number(countRes.rows[0]?.c ?? 0);

  const limIdx = baseParams.length + 1;
  const offIdx = baseParams.length + 2;
  const dataSql = `${JOB_SELECT} WHERE ${whereSql} ORDER BY ${order} LIMIT $${limIdx}::int OFFSET $${offIdx}::int`;
  const { rows } = await pool.query(dataSql, [...baseParams, limit, offset]);
  return { rows: rows.map(toJobRow), total };
}

/** Legacy simple list — used by callers expecting only pagination */
export async function listJobs(options: {
  limit: number;
  offset: number;
}): Promise<JobRow[]> {
  const { rows } = await listJobsFiltered({
    limit: options.limit,
    offset: options.offset,
    sort: "created_at_desc",
  });
  return rows;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getJobById(jobId: string): Promise<JobRow | null> {
  const id = jobId.trim();
  if (!id || !UUID_RE.test(id)) return null;
  const { rows } = await pool.query(`${JOB_SELECT} WHERE id = $1::uuid`, [id]);
  if (rows.length === 0) return null;
  return toJobRow(rows[0]);
}

/** Slack outbound message pipeline (`public.slack_message_jobs`). */
export type SlackMessageJobRow = {
  id: string;
  bull_job_id: string | null;
  channel: string;
  message_text: string | null;
  status: string;
  result: unknown;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function toSlackMessageJobRow(r: QueryResultRow): SlackMessageJobRow {
  return {
    id: String(r.id),
    bull_job_id: r.bull_job_id ?? null,
    channel: r.channel ?? "",
    message_text: r.message_text ?? null,
    status: r.status ?? "",
    result: r.result ?? null,
    error_message: r.error_message ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

const SLACK_MESSAGE_JOB_SELECT = `SELECT id, bull_job_id, channel, message_text, status, result, error_message, created_at, updated_at
     FROM public.slack_message_jobs`;

export type SlackMessageJobSort =
  | "created_at_desc"
  | "created_at_asc"
  | "updated_at_desc"
  | "updated_at_asc";

export function parseSlackMessageJobSort(
  raw: string | undefined
): SlackMessageJobSort | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (
    s === "created_at_desc" ||
    s === "created_at_asc" ||
    s === "updated_at_desc" ||
    s === "updated_at_asc"
  ) {
    return s;
  }
  return undefined;
}

function slackMessageJobOrderClause(sort: SlackMessageJobSort | undefined): string {
  switch (sort) {
    case "created_at_asc":
      return "created_at ASC NULLS LAST, id ASC";
    case "updated_at_desc":
      return "updated_at DESC NULLS LAST, id DESC";
    case "updated_at_asc":
      return "updated_at ASC NULLS LAST, id ASC";
    default:
      return "created_at DESC NULLS LAST, id DESC";
  }
}

export type SlackMessageJobListFilters = {
  limit: number;
  offset: number;
  sort: SlackMessageJobSort;
  /** Exact status match (lowercase) */
  statusIn?: string[];
  /** When statusIn not set */
  statusGroup?: "completed" | "failed" | "queued";
  /**
   * Slack destination encoded in `channel`: user IDs start with U, public channels with C.
   */
  channelKind?: "user" | "channel";
  channelContains?: string;
  bullJobIdContains?: string;
  /** Search channel, message body, status, bull id, error, id */
  q?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  hasError?: boolean;
};

function buildSlackMessageJobWhere(
  f: SlackMessageJobListFilters
): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (f.statusIn && f.statusIn.length > 0) {
    const cleaned = f.statusIn
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (cleaned.length) {
      parts.push(`LOWER(TRIM(status)) = ANY($${i}::text[])`);
      params.push(cleaned);
      i++;
    }
  } else if (f.statusGroup === "completed") {
    parts.push(
      `(LOWER(TRIM(status)) IN (
        'sent','delivered','success','completed','succeeded','ok','done'
      ))`
    );
  } else if (f.statusGroup === "failed") {
    parts.push(
      `(LOWER(TRIM(status)) IN ('failed','failure','error','errored'))`
    );
  } else if (f.statusGroup === "queued") {
    parts.push(`(LOWER(TRIM(status)) NOT IN (
      'sent','delivered','success','completed','succeeded','ok','done',
      'failed','failure','error','errored'
    ))`);
  }

  if (f.channelKind === "user") {
    parts.push(`LEFT(BTRIM(channel), 1) = 'U'`);
  } else if (f.channelKind === "channel") {
    parts.push(`LEFT(BTRIM(channel), 1) = 'C'`);
  }

  if (f.channelContains?.trim()) {
    parts.push(`channel ILIKE $${i}`);
    params.push(`%${f.channelContains.trim()}%`);
    i++;
  }
  if (f.bullJobIdContains?.trim()) {
    parts.push(`COALESCE(bull_job_id,'') ILIKE $${i}`);
    params.push(`%${f.bullJobIdContains.trim()}%`);
    i++;
  }
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    parts.push(`(
      channel ILIKE $${i}
      OR COALESCE(message_text,'') ILIKE $${i}
      OR LOWER(TRIM(status)) ILIKE LOWER($${i})
      OR COALESCE(bull_job_id,'') ILIKE $${i}
      OR COALESCE(error_message,'') ILIKE $${i}
      OR id::text ILIKE $${i}
    )`);
    params.push(q);
    i++;
  }
  if (f.createdFrom) {
    parts.push(`created_at >= $${i}::timestamptz`);
    params.push(f.createdFrom);
    i++;
  }
  if (f.createdTo) {
    parts.push(`created_at <= $${i}::timestamptz`);
    params.push(f.createdTo);
    i++;
  }
  if (f.updatedFrom) {
    parts.push(`updated_at >= $${i}::timestamptz`);
    params.push(f.updatedFrom);
    i++;
  }
  if (f.updatedTo) {
    parts.push(`updated_at <= $${i}::timestamptz`);
    params.push(f.updatedTo);
    i++;
  }
  if (f.hasError === true) {
    parts.push(`error_message IS NOT NULL AND TRIM(error_message) <> ''`);
  } else if (f.hasError === false) {
    parts.push(`(error_message IS NULL OR TRIM(error_message) = '')`);
  }

  const sql = parts.length ? parts.join(" AND ") : "TRUE";
  return { sql, params };
}

export async function listSlackMessageJobsFiltered(
  filters: SlackMessageJobListFilters
): Promise<{ rows: SlackMessageJobRow[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit, 1), 500);
  const offset = Math.max(filters.offset, 0);
  const { sql: whereSql, params: baseParams } = buildSlackMessageJobWhere(filters);
  const order = slackMessageJobOrderClause(filters.sort);

  const countRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM public.slack_message_jobs WHERE ${whereSql}`,
    baseParams
  );
  const total = Number(countRes.rows[0]?.c ?? 0);

  const limIdx = baseParams.length + 1;
  const offIdx = baseParams.length + 2;
  const dataSql = `${SLACK_MESSAGE_JOB_SELECT} WHERE ${whereSql} ORDER BY ${order} LIMIT $${limIdx}::int OFFSET $${offIdx}::int`;
  const { rows } = await pool.query(dataSql, [...baseParams, limit, offset]);
  return { rows: rows.map(toSlackMessageJobRow), total };
}

export async function getSlackMessageJobById(
  id: string
): Promise<SlackMessageJobRow | null> {
  const raw = id.trim();
  if (!raw || !UUID_RE.test(raw)) return null;
  const { rows } = await pool.query(
    `${SLACK_MESSAGE_JOB_SELECT} WHERE id = $1::uuid`,
    [raw]
  );
  if (rows.length === 0) return null;
  return toSlackMessageJobRow(rows[0]);
}

/** Slack Atlas sync pipeline (`public.slack_atlas_sync_jobs`). */
export type SlackAtlasSyncJobRow = {
  id: string;
  bull_job_id: string | null;
  slack_user_id: string;
  status: string;
  result: unknown;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function toSlackAtlasSyncJobRow(r: QueryResultRow): SlackAtlasSyncJobRow {
  return {
    id: String(r.id),
    bull_job_id: r.bull_job_id ?? null,
    slack_user_id: r.slack_user_id ?? "",
    status: r.status ?? "",
    result: r.result ?? null,
    error_message: r.error_message ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

const SLACK_ATLAS_SYNC_JOB_SELECT = `SELECT id, bull_job_id, slack_user_id, status, result, error_message, created_at, updated_at
     FROM public.slack_atlas_sync_jobs`;

export type SlackAtlasSyncJobSort =
  | "created_at_desc"
  | "created_at_asc"
  | "updated_at_desc"
  | "updated_at_asc";

export function parseSlackAtlasSyncJobSort(
  raw: string | undefined
): SlackAtlasSyncJobSort | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (
    s === "created_at_desc" ||
    s === "created_at_asc" ||
    s === "updated_at_desc" ||
    s === "updated_at_asc"
  ) {
    return s;
  }
  return undefined;
}

function slackAtlasSyncJobOrderClause(
  sort: SlackAtlasSyncJobSort | undefined
): string {
  switch (sort) {
    case "created_at_asc":
      return "created_at ASC NULLS LAST, id ASC";
    case "updated_at_desc":
      return "updated_at DESC NULLS LAST, id DESC";
    case "updated_at_asc":
      return "updated_at ASC NULLS LAST, id ASC";
    default:
      return "created_at DESC NULLS LAST, id DESC";
  }
}

export type SlackAtlasSyncJobListFilters = {
  limit: number;
  offset: number;
  sort: SlackAtlasSyncJobSort;
  statusIn?: string[];
  statusGroup?: "completed" | "failed" | "queued";
  slackUserId?: string;
  bullJobIdContains?: string;
  q?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  hasError?: boolean;
};

function buildSlackAtlasSyncJobWhere(
  f: SlackAtlasSyncJobListFilters
): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (f.statusIn && f.statusIn.length > 0) {
    const cleaned = f.statusIn
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (cleaned.length) {
      parts.push(`LOWER(TRIM(status)) = ANY($${i}::text[])`);
      params.push(cleaned);
      i++;
    }
  } else if (f.statusGroup === "completed") {
    parts.push(
      `(LOWER(TRIM(status)) IN (
        'sent','delivered','success','completed','succeeded','ok','done'
      ))`
    );
  } else if (f.statusGroup === "failed") {
    parts.push(
      `(LOWER(TRIM(status)) IN ('failed','failure','error','errored'))`
    );
  } else if (f.statusGroup === "queued") {
    parts.push(`(LOWER(TRIM(status)) NOT IN (
      'sent','delivered','success','completed','succeeded','ok','done',
      'failed','failure','error','errored'
    ))`);
  }

  if (f.slackUserId?.trim()) {
    parts.push(`slack_user_id = $${i}`);
    params.push(f.slackUserId.trim());
    i++;
  }
  if (f.bullJobIdContains?.trim()) {
    parts.push(`COALESCE(bull_job_id,'') ILIKE $${i}`);
    params.push(`%${f.bullJobIdContains.trim()}%`);
    i++;
  }
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    parts.push(`(
      slack_user_id ILIKE $${i}
      OR LOWER(TRIM(status)) ILIKE LOWER($${i})
      OR COALESCE(bull_job_id,'') ILIKE $${i}
      OR COALESCE(error_message,'') ILIKE $${i}
      OR id::text ILIKE $${i}
    )`);
    params.push(q);
    i++;
  }
  if (f.createdFrom) {
    parts.push(`created_at >= $${i}::timestamptz`);
    params.push(f.createdFrom);
    i++;
  }
  if (f.createdTo) {
    parts.push(`created_at <= $${i}::timestamptz`);
    params.push(f.createdTo);
    i++;
  }
  if (f.updatedFrom) {
    parts.push(`updated_at >= $${i}::timestamptz`);
    params.push(f.updatedFrom);
    i++;
  }
  if (f.updatedTo) {
    parts.push(`updated_at <= $${i}::timestamptz`);
    params.push(f.updatedTo);
    i++;
  }
  if (f.hasError === true) {
    parts.push(`error_message IS NOT NULL AND TRIM(error_message) <> ''`);
  } else if (f.hasError === false) {
    parts.push(`(error_message IS NULL OR TRIM(error_message) = '')`);
  }

  const sql = parts.length ? parts.join(" AND ") : "TRUE";
  return { sql, params };
}

export async function listSlackAtlasSyncJobsFiltered(
  filters: SlackAtlasSyncJobListFilters
): Promise<{ rows: SlackAtlasSyncJobRow[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit, 1), 500);
  const offset = Math.max(filters.offset, 0);
  const { sql: whereSql, params: baseParams } =
    buildSlackAtlasSyncJobWhere(filters);
  const order = slackAtlasSyncJobOrderClause(filters.sort);

  const countRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM public.slack_atlas_sync_jobs WHERE ${whereSql}`,
    baseParams
  );
  const total = Number(countRes.rows[0]?.c ?? 0);

  const limIdx = baseParams.length + 1;
  const offIdx = baseParams.length + 2;
  const dataSql = `${SLACK_ATLAS_SYNC_JOB_SELECT} WHERE ${whereSql} ORDER BY ${order} LIMIT $${limIdx}::int OFFSET $${offIdx}::int`;
  const { rows } = await pool.query(dataSql, [...baseParams, limit, offset]);
  return { rows: rows.map(toSlackAtlasSyncJobRow), total };
}

export async function getSlackAtlasSyncJobById(
  id: string
): Promise<SlackAtlasSyncJobRow | null> {
  const raw = id.trim();
  if (!raw || !UUID_RE.test(raw)) return null;
  const { rows } = await pool.query(
    `${SLACK_ATLAS_SYNC_JOB_SELECT} WHERE id = $1::uuid`,
    [raw]
  );
  if (rows.length === 0) return null;
  return toSlackAtlasSyncJobRow(rows[0]);
}

export type JobFacets = {
  jobTypes: string[];
  statuses: string[];
};

export async function getJobFacets(): Promise<JobFacets> {
  const [typesRes, statusRes] = await Promise.all([
    pool.query<{ job_type: string }>(
      `SELECT DISTINCT job_type FROM public.jobs ORDER BY job_type ASC LIMIT 500`
    ),
    pool.query<{ status: string }>(
      `SELECT DISTINCT status FROM public.jobs ORDER BY status ASC LIMIT 500`
    ),
  ]);
  return {
    jobTypes: typesRes.rows.map((r) => r.job_type).filter(Boolean),
    statuses: statusRes.rows.map((r) => r.status).filter(Boolean),
  };
}

export async function listSlackInstallations(): Promise<SlackInstallationRow[]> {
  const { rows } = await pool.query(
    `SELECT slack_team_id, team_name, app_name, app_id, enterprise_id, enterprise_name, user_id, bot_id, scopes, app_base_url, installed_at, updated_at
     FROM public.slack_installation
     ORDER BY installed_at DESC NULLS LAST, slack_team_id ASC`
  );
  return rows.map(toSlackInstallationRow);
}

/** Targets for dashboard health probes: `{app_base_url}/health` per install, deduped by URL. */
export type SlackHealthProbeTarget = {
  healthUrl: string;
  /** Card title (typically app name). */
  displayName: string;
  /** Shown below the title in a grey capsule when both name and id exist. */
  appIdLabel?: string | null;
};

function appBaseToHealthUrl(raw: string): string | null {
  const base = raw.trim().replace(/\/+$/, "");
  if (!base) return null;
  try {
    const u = new URL(base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${base}/health`;
  } catch {
    return null;
  }
}

export async function listSlackHealthProbeTargets(): Promise<
  SlackHealthProbeTarget[]
> {
  const { rows } = await pool.query<{
    slack_team_id: string;
    app_name: string | null;
    app_id: string | null;
    app_base_url: string | null;
  }>(
    `SELECT slack_team_id, app_name, app_id, app_base_url
     FROM public.slack_installation
     WHERE app_base_url IS NOT NULL AND BTRIM(app_base_url::text) <> ''
     ORDER BY installed_at DESC NULLS LAST, slack_team_id ASC`
  );

  const seen = new Set<string>();
  const out: SlackHealthProbeTarget[] = [];

  for (const r of rows) {
    const healthUrl = appBaseToHealthUrl(String(r.app_base_url ?? ""));
    if (!healthUrl) continue;
    if (seen.has(healthUrl)) continue;
    seen.add(healthUrl);
    const appName = r.app_name?.trim() || null;
    const appId = r.app_id?.trim() || null;

    let displayName: string;
    let appIdLabel: string | null | undefined;

    if (appName && appId) {
      displayName = appName;
      appIdLabel = appId;
    } else if (appName) {
      displayName = appName;
      appIdLabel = undefined;
    } else if (appId) {
      displayName = appId;
      appIdLabel = undefined;
    } else {
      displayName = r.slack_team_id || "Slack app";
      appIdLabel = undefined;
    }

    out.push({ healthUrl, displayName, appIdLabel });
  }

  return out;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // One round-trip for all headline counts (avoids parallel checkouts that exhaust
  // small DB connection limits). Time series runs after, still one at a time.
  const { rows } = await pool.query<{
    users_c: string;
    installs_c: string;
    total: string;
    completed: string;
    failed: string;
    queued: string;
  }>(
    `WITH all_jobs AS (
       SELECT status FROM public.jobs
       UNION ALL
       SELECT status FROM public.slack_message_jobs
       UNION ALL
       SELECT status FROM public.slack_atlas_sync_jobs
     )
     SELECT
       u.c AS users_c,
       i.c AS installs_c,
       j.total,
       j.completed,
       j.failed,
       j.queued
     FROM (SELECT COUNT(*)::text AS c FROM public.users) u,
          (SELECT COUNT(*)::text AS c FROM public.slack_installation) i,
          (
            SELECT
              COUNT(*)::text AS total,
              COUNT(*) FILTER (
                WHERE LOWER(TRIM(status)) IN (
                  'completed', 'success', 'succeeded', 'complete'
                )
              )::text AS completed,
              COUNT(*) FILTER (
                WHERE LOWER(TRIM(status)) IN (
                  'failed', 'failure', 'error', 'errored'
                )
              )::text AS failed,
              COUNT(*) FILTER (
                WHERE LOWER(TRIM(status)) NOT IN (
                  'completed', 'success', 'succeeded', 'complete',
                  'failed', 'failure', 'error', 'errored'
                )
              )::text AS queued
            FROM all_jobs
          ) j`
  );

  const row = rows[0];
  const jobsLast7d = await getJobsStatusBucketsLast7Days();

  return {
    usersOnboarded: Number(row?.users_c ?? 0),
    slackInstallations: Number(row?.installs_c ?? 0),
    activeSessions: 0,
    jobs: {
      total: Number(row?.total ?? 0),
      queued: Number(row?.queued ?? 0),
      failed: Number(row?.failed ?? 0),
      completed: Number(row?.completed ?? 0),
    },
    jobsLast7d,
  };
}
