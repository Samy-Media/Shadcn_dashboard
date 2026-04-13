import type { HealthCheckEntry } from "@/lib/health-check-types";

function strVal(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return null;
}

function isOkToken(v: unknown): boolean {
  const s = strVal(v)?.toLowerCase().trim();
  return s === "ok" || s === "live" || s === "healthy" || s === "up";
}

/**
 * Same rules as the Health tab: HTTP ok, optional JSON payload checks (ok, status, db, redis).
 */
export function isHealthCheckEntryHealthy(entry: HealthCheckEntry): boolean {
  if (entry.error || !entry.httpOk) return false;
  const p = entry.payload;
  if (!p) return entry.httpOk;
  const overall = p.ok === true || p.ok === "true";
  const status = strVal(p.status);
  const db = strVal(p.db);
  const redis = strVal(p.redis);
  const st = status?.toLowerCase().trim();
  const statusLive =
    !status ||
    st === "live" ||
    st === "ok" ||
    st === "healthy" ||
    st === "up";
  const dbOk = !db || isOkToken(db);
  const redisOk = !redis || isOkToken(redis);
  return overall && statusLive && dbOk && redisOk;
}
