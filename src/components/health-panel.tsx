"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";

import type { HealthCheckEntry } from "@/lib/health-check-types";
import { isHealthCheckEntryHealthy } from "@/lib/health-entry-status";
import { InfoTip } from "@/components/info-tip";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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

function StatusPill({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge
        variant={good ? "default" : "destructive"}
        className="font-mono text-xs font-normal"
      >
        {value}
      </Badge>
    </div>
  );
}

export function HealthPanel() {
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<HealthCheckEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health-check");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Health check failed");
      }
      setCheckedAt(json.data.checkedAt as string);
      setResults(json.data.results as HealthCheckEntry[]);
    } catch (e) {
      setResults([]);
      setCheckedAt(null);
      setError(e instanceof Error ? e.message : "Health check failed");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="space-y-6">
      <PageHeading
        icon={Activity}
        title="Health"
        description={
          <>
            <span>
              Ping each connected app’s health URL and read the response.
            </span>
            <InfoTip label="How targets are chosen">
              <p>
                Calls <code>app_base_url</code>/health for each row in{" "}
                <code>public.slack_installation</code> that has{" "}
                <code>app_base_url</code> set.
              </p>
              <p>
                Optional extra URLs: set <code>HEALTH_CHECK_URLS</code>{" "}
                (comma-separated base URLs, or full /health URLs).
              </p>
            </InfoTip>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {checkedAt ? (
          <p className="text-muted-foreground text-xs">
            Last check:{" "}
            <span className="text-foreground font-mono">
              {format(new Date(checkedAt), "PPpp")}
            </span>
          </p>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-lg"
          onClick={() => void run()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 size-3.5" />
          )}
          Check now
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertCircle className="size-4" />
              Could not load health
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {loading && results.length === 0 && !error ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse border-border/60">
              <CardHeader>
                <div className="bg-muted h-5 w-40 rounded-md" />
                <div className="bg-muted mt-2 h-4 w-full max-w-sm rounded-md" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="bg-muted h-10 rounded-lg" />
                <div className="bg-muted h-10 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && results.length === 0 && !error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No targets</CardTitle>
            <CardDescription className="flex flex-wrap items-start gap-1.5">
              <span>
                Add an app base URL on each Slack installation, or add extra URLs in
                the environment.
              </span>
              <InfoTip label="Technical detail">
                <p>
                  Calls <code>app_base_url</code>/health for each row in{" "}
                  <code>public.slack_installation</code> that has{" "}
                  <code>app_base_url</code>. Optional: <code>HEALTH_CHECK_URLS</code>{" "}
                  (comma-separated bases or full /health URLs).
                </p>
              </InfoTip>
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {results.map((entry) => {
          const healthy = isHealthCheckEntryHealthy(entry);
          const p = entry.payload;
          const status = strVal(p?.status);
          const db = strVal(p?.db);
          const redis = strVal(p?.redis);
          const okFlag = p?.ok;

          return (
            <Card
              key={entry.url}
              className={cn(
                "border-border/60 shadow-sm",
                healthy
                  ? "border-emerald-500/25 bg-emerald-500/[0.03]"
                  : "border-amber-500/20"
              )}
            >
              <CardHeader className="space-y-1 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="min-w-0 flex-1 text-lg font-semibold leading-snug">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Server className="text-primary size-5 shrink-0" />
                        <span className="truncate">{entry.displayName}</span>
                      </div>
                      {entry.appIdLabel ? (
                        <span className="ml-7 inline-flex w-fit max-w-full rounded-full border border-border/50 bg-muted/90 px-2.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground shadow-sm">
                          <span className="truncate">{entry.appIdLabel}</span>
                        </span>
                      ) : null}
                    </div>
                  </CardTitle>
                  {entry.error ? (
                    <Badge variant="destructive" className="shrink-0">
                      Error
                    </Badge>
                  ) : healthy ? (
                    <Badge className="shrink-0 border-emerald-600/30 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="mr-1 size-3.5" />
                      Healthy
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      Degraded
                    </Badge>
                  )}
                </div>
                <CardDescription className="font-mono text-[11px] break-all">
                  {entry.url}
                </CardDescription>
                <p className="text-muted-foreground text-xs">
                  HTTP {entry.httpStatus || "—"} · {entry.latencyMs} ms
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {entry.error ? (
                  <p className="text-destructive text-sm">{entry.error}</p>
                ) : (
                  <>
                    <StatusPill
                      label="ok"
                      value={
                        okFlag === true || okFlag === "true"
                          ? "true"
                          : okFlag === false || okFlag === "false"
                            ? "false"
                            : strVal(okFlag) ?? "—"
                      }
                      good={okFlag === true || okFlag === "true"}
                    />
                    <StatusPill
                      label="status"
                      value={status ?? "—"}
                      good={!!status && isOkToken(status)}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <StatusPill
                        label="db"
                        value={db ?? "—"}
                        good={!db || isOkToken(db)}
                      />
                      <StatusPill
                        label="redis"
                        value={redis ?? "—"}
                        good={!redis || isOkToken(redis)}
                      />
                    </div>
                    {p && Object.keys(p).length > 0 ? (
                      <>
                        <Separator />
                        <div className="space-y-1">
                          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                            <Database className="size-3" />
                            Raw payload
                          </p>
                          <pre className="bg-muted/50 max-h-40 overflow-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed">
                            {JSON.stringify(p, null, 2)}
                          </pre>
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
