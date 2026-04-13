import type { NextApiRequest, NextApiResponse } from "next";
import type { HealthCheckEntry } from "@/lib/health-check-types";
import { listSlackHealthProbeTargets } from "@/lib/operations-queries";

/** Optional comma-separated base URLs or full /health URLs (extra probes beyond DB). */
const ENV_URLS = process.env.HEALTH_CHECK_URLS;

function listEnvChunks(): string[] {
  const raw = ENV_URLS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function resolveHealthUrl(raw: string): string {
  const u = new URL(raw.trim());
  if (u.pathname === "/" || u.pathname === "") {
    u.pathname = "/health";
  }
  return u.toString();
}

type Probe = {
  url: string;
  displayName?: string;
  appIdLabel?: string | null;
};

async function buildProbes(): Promise<Probe[]> {
  const fromDb = await listSlackHealthProbeTargets();
  const probes: Probe[] = fromDb.map((t) => ({
    url: t.healthUrl,
    displayName: t.displayName,
    appIdLabel: t.appIdLabel,
  }));
  const seen = new Set(probes.map((p) => p.url));

  for (const chunk of listEnvChunks()) {
    try {
      const url = resolveHealthUrl(chunk);
      if (!seen.has(url)) {
        seen.add(url);
        probes.push({ url });
      }
    } catch {
      console.warn("health-check: skipping invalid HEALTH_CHECK_URLS entry:", chunk);
    }
  }

  return probes;
}

function normalizeAppIdLabel(
  raw: string | null | undefined
): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const t = String(raw).trim();
  return t || undefined;
}

async function probeOne(
  target: string,
  meta?: { displayName?: string; appIdLabel?: string | null }
): Promise<HealthCheckEntry> {
  const appIdLabel = normalizeAppIdLabel(meta?.appIdLabel);

  let url: string;
  try {
    url = resolveHealthUrl(target);
  } catch {
    return {
      displayName: target,
      ...(appIdLabel ? { appIdLabel } : {}),
      url: target,
      httpOk: false,
      httpStatus: 0,
      latencyMs: 0,
      error: "Invalid URL",
      payload: null,
    };
  }

  let resolvedDisplay: string;
  if (meta?.displayName?.trim()) {
    resolvedDisplay = meta.displayName.trim();
  } else {
    try {
      resolvedDisplay = new URL(url).host;
    } catch {
      resolvedDisplay = target;
    }
  }

  const started = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "69420",
      },
    });
    const latencyMs = Date.now() - started;
    const text = await res.text();
    let payload: Record<string, unknown> | null = null;
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        payload =
          parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { value: parsed };
      } catch {
        payload = { _parseError: true, _rawPreview: text.slice(0, 400) };
      }
    }

    return {
      displayName: resolvedDisplay,
      ...(appIdLabel ? { appIdLabel } : {}),
      url,
      httpOk: res.ok,
      httpStatus: res.status,
      latencyMs,
      error: null,
      payload,
    };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const msg =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Request timed out"
          : e.message
        : "Request failed";
    return {
      displayName: resolvedDisplay,
      ...(appIdLabel ? { appIdLabel } : {}),
      url,
      httpOk: false,
      httpStatus: 0,
      latencyMs,
      error: msg,
      payload: null,
    };
  } finally {
    clearTimeout(t);
  }
}

type Ok = {
  success: true;
  data: { checkedAt: string; results: HealthCheckEntry[] };
};
type Err = { success: false; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const probes = await buildProbes();
    if (probes.length === 0) {
      return res.status(200).json({
        success: true,
        data: { checkedAt: new Date().toISOString(), results: [] },
      });
    }

    const results = await Promise.all(
      probes.map((p) =>
        probeOne(p.url, {
          displayName: p.displayName,
          appIdLabel: p.appIdLabel,
        })
      )
    );
    return res.status(200).json({
      success: true,
      data: { checkedAt: new Date().toISOString(), results },
    });
  } catch (error) {
    console.error("health-check error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to run health checks",
    });
  }
}
