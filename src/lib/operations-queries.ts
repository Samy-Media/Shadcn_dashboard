import type { QueryResultRow } from "pg";
import pool from "@/lib/db";

export type UserRow = {
  slack_user_id: string;
  slack_team_id: string;
  email: string | null;
  /** BIGINT from Postgres (node-pg may return string) */
  requester_id: string | null;
  /** Apps the user has active (Safserv / internal) */
  safserv_active: boolean | null;
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
  enterprise_id: string | null;
  enterprise_name: string | null;
  user_id: string | null;
  bot_id: string | null;
  scopes: string | null;
  installed_at: string | null;
  updated_at: string | null;
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
};

function toUserRow(r: QueryResultRow): UserRow {
  return {
    slack_user_id: r.slack_user_id,
    slack_team_id: r.slack_team_id ?? "",
    email: r.email ?? null,
    requester_id:
      r.requester_id === null || r.requester_id === undefined
        ? null
        : String(r.requester_id),
    safserv_active:
      r.safserv_active === null || r.safserv_active === undefined
        ? null
        : Boolean(r.safserv_active),
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
    enterprise_id: r.enterprise_id ?? null,
    enterprise_name: r.enterprise_name ?? null,
    user_id: r.user_id ?? null,
    bot_id: r.bot_id ?? null,
    scopes: r.scopes ?? null,
    installed_at: r.installed_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

const USERS_SELECT = `SELECT slack_user_id, slack_team_id, email, requester_id, safserv_active,
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
  /** true = safserv_active IS TRUE; false = IS NOT TRUE */
  safservActive?: boolean;
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
  if (f.safservActive === true) {
    parts.push(`safserv_active IS TRUE`);
  } else if (f.safservActive === false) {
    parts.push(`safserv_active IS NOT TRUE`);
  }
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    parts.push(`(
      slack_user_id ILIKE $${i}
      OR COALESCE(email, '') ILIKE $${i}
      OR COALESCE(slack_team_id, '') ILIKE $${i}
      OR COALESCE(requester_id::text, '') ILIKE $${i}
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
    `SELECT slack_team_id, team_name, enterprise_id, enterprise_name, user_id, bot_id, scopes, installed_at, updated_at
     FROM public.slack_installation
     ORDER BY installed_at DESC NULLS LAST, slack_team_id ASC`
  );
  return rows.map(toSlackInstallationRow);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [usersRes, installsRes, jobsRes] = await Promise.all([
    pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM public.users`
    ),
    pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM public.slack_installation`
    ),
    pool.query<{
      total: string;
      completed: string;
      failed: string;
      queued: string;
    }>(
      `SELECT
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
       FROM public.jobs`
    ),
  ]);

  const jobs = jobsRes.rows[0];
  return {
    usersOnboarded: Number(usersRes.rows[0]?.c ?? 0),
    slackInstallations: Number(installsRes.rows[0]?.c ?? 0),
    activeSessions: 0,
    jobs: {
      total: Number(jobs?.total ?? 0),
      queued: Number(jobs?.queued ?? 0),
      failed: Number(jobs?.failed ?? 0),
      completed: Number(jobs?.completed ?? 0),
    },
  };
}
