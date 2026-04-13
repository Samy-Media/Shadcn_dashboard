"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Activity,
  KeyRound,
  Building2,
  CheckCircle2,
  Layers3,
  Loader2,
  PieChart,
  Users,
  XCircle,
} from "lucide-react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import type { HealthCheckEntry } from "@/lib/health-check-types";
import { isHealthCheckEntryHealthy } from "@/lib/health-entry-status";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { InfoTip } from "@/components/info-tip";
import { PageHeading } from "@/components/page-heading";
import { ValueShimmer } from "@/components/value-shimmer";
import { cn } from "@/lib/utils";

type StatsPayload = {
  usersOnboarded: number;
  slackInstallations: number;
  activeSessions: number;
  jobs: {
    total: number;
    queued: number;
    failed: number;
    completed: number;
  };
  jobsLast7d: {
    bucket: string;
    completed: number;
    failed: number;
    queued: number;
    jobs: number;
    messages: number;
    atlas: number;
  }[];
};

const STATUS_BAR_FILLS = [
  "hsl(38 92% 45%)",
  "hsl(0 72% 51%)",
  "hsl(142 71% 40%)",
] as const;

const jobsStatusChartConfig = {
  queued: {
    label: "Queued",
    color: STATUS_BAR_FILLS[0],
  },
  failed: {
    label: "Failed",
    color: STATUS_BAR_FILLS[1],
  },
  completed: {
    label: "Completed",
    color: STATUS_BAR_FILLS[2],
  },
  jobs: {
    label: "Ticket Jobs",
    color: "hsl(210 90% 60%)",
  },
  messages: {
    label: "Messages",
    color: "hsl(262 83% 66%)",
  },
  atlas: {
    label: "Atlas",
    color: "hsl(188 78% 45%)",
  },
} satisfies ChartConfig;

function ChartAreaShimmer() {
  const bars = [100, 168, 124] as const;
  return (
    <div className="flex h-[min(280px,40vh)] min-h-[200px] items-end justify-center gap-6 px-4">
      {bars.map((h, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <ValueShimmer
            className="block w-11 rounded-md sm:w-14"
            style={{ height: h }}
          />
          <ValueShimmer className="h-3 w-10 sm:w-12" />
        </div>
      ))}
    </div>
  );
}

function SourceLegendItem({
  label,
  color,
  dashed = false,
}: {
  label: string;
  color: string;
  dashed?: boolean;
}) {
  return (
    <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
      <span
        className={cn(
          "inline-block h-0.5 w-5 rounded-full",
          dashed && "bg-transparent"
        )}
        style={
          dashed
            ? {
                backgroundImage: `repeating-linear-gradient(to right, ${color} 0 6px, transparent 6px 10px)`,
              }
            : { backgroundColor: color }
        }
      />
      <span>{label}</span>
    </div>
  );
}

function LegendDot({
  color,
}: {
  color: string;
}) {
  return (
    <span
      className="inline-block size-2.5 rounded-[4px]"
      style={{ backgroundColor: color }}
    />
  );
}

type HealthSnapshot = {
  live: number;
  degraded: number;
  total: number;
  checkedAt: string;
};

export function OperationsDashboard() {
  const [stats, setStats] = React.useState<StatsPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [health, setHealth] = React.useState<HealthSnapshot | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);
  const [healthError, setHealthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stats");
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message ?? "Failed to load stats");
        }
        if (!cancelled) setStats(json.data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load stats");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setHealthLoading(true);
      setHealthError(null);
      try {
        const res = await fetch("/api/health-check");
        const json = (await res.json()) as {
          success?: boolean;
          data?: { checkedAt: string; results: HealthCheckEntry[] };
          message?: string;
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.message ?? "Failed to load health snapshot");
        }
        const results = json.data.results;
        const live = results.filter(isHealthCheckEntryHealthy).length;
        if (!cancelled) {
          setHealth({
            live,
            degraded: results.length - live,
            total: results.length,
            checkedAt: json.data.checkedAt,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setHealth(null);
          setHealthError(
            e instanceof Error ? e.message : "Failed to load health snapshot"
          );
        }
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const jobsTimeSeriesData = React.useMemo(() => {
    if (!stats?.jobsLast7d?.length) return [];
    return stats.jobsLast7d.map((b) => ({
      label: format(new Date(b.bucket), "MMM d"),
      queued: b.queued,
      failed: b.failed,
      completed: b.completed,
      jobs: b.jobs,
      messages: b.messages,
      atlas: b.atlas,
    }));
  }, [stats]);

  if (error && !stats) {
    return (
      <section className="space-y-6">
        <PageHeading
          icon={PieChart}
          title="Operations overview"
          description={
            <>
              <span>
                A quick snapshot of users, workspaces, jobs, sessions, and how your
                apps look on health checks.
              </span>
              <InfoTip label="Where the numbers come from">
                <p>
                  Most figures come from the database. Active sessions use Redis.
                  Job totals follow the stats API. Health live vs degraded matches
                  the Health page (same endpoints).
                </p>
              </InfoTip>
            </>
          }
        />
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>Could not load operations data</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const s = stats;

  return (
    <section className="space-y-6">
      <PageHeading
        icon={PieChart}
        title="Operations overview"
        description={
          <>
            <span>
              A quick snapshot of users, workspaces, jobs, sessions, and how your
              apps look on health checks.
            </span>
            <InfoTip label="Where the numbers come from">
              <p>
                Most figures come from the database. Active sessions use Redis. Job
                totals follow the stats API. Health live vs degraded matches the
                Health page (same endpoints).
              </p>
            </InfoTip>
          </>
        }
      />

      {/* KPI row — horizontal band */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 md:gap-4">
        <Card className="@container/card border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>Users onboarded</CardDescription>
            <Users className="text-muted-foreground size-4" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">
              {loading ? (
                <ValueShimmer className="h-9 w-[3ch] min-w-[3rem]" />
              ) : (
                s?.usersOnboarded ?? "—"
              )}
            </div>
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1 text-xs">
              <span>People in the directory.</span>
              <InfoTip label="Source">
                <p>
                  Count from <code>public.users</code>.
                </p>
              </InfoTip>
            </p>
          </CardContent>
        </Card>

        <Card className="@container/card border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>Slack workspaces</CardDescription>
            <Building2 className="text-muted-foreground size-4" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">
              {loading ? (
                <ValueShimmer className="h-9 w-[3ch] min-w-[3rem]" />
              ) : (
                s?.slackInstallations ?? "—"
              )}
            </div>
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1 text-xs">
              <span>Workspaces with the app installed.</span>
              <InfoTip label="Source">
                <p>
                  Count from <code>public.slack_installation</code>.
                </p>
              </InfoTip>
            </p>
          </CardContent>
        </Card>

        <Card className="@container/card border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>Jobs completed</CardDescription>
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {loading ? (
                <ValueShimmer className="h-9 w-[3ch] min-w-[3rem]" />
              ) : (
                s?.jobs.completed ?? "—"
              )}
            </div>
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1 text-xs">
              <span>Finished successfully.</span>
              <InfoTip label="Which statuses count">
                <p>
                  We count jobs whose status is completed, success, succeeded, or
                  similar terminal success values.
                </p>
              </InfoTip>
            </p>
          </CardContent>
        </Card>

        <Card className="@container/card border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>Active sessions</CardDescription>
            <KeyRound className="text-muted-foreground size-4" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">
              {loading ? (
                <ValueShimmer className="h-9 w-[3ch] min-w-[3rem]" />
              ) : (
                s?.activeSessions ?? "—"
              )}
            </div>
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1 text-xs">
              <span>Live sessions in Redis.</span>
              <InfoTip label="How this is counted">
                <p>
                  Pulled from the same session store as the Sessions page, via the
                  sessions count API.
                </p>
              </InfoTip>
            </p>
          </CardContent>
        </Card>

        <Card className="@container/card border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>Jobs failed</CardDescription>
            <XCircle className="size-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums text-red-700 dark:text-red-400">
              {loading ? (
                <ValueShimmer className="h-9 w-[3ch] min-w-[3rem]" />
              ) : (
                s?.jobs.failed ?? "—"
              )}
            </div>
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1 text-xs">
              <span>Runs that failed or errored.</span>
              <InfoTip label="Which statuses count">
                <p>
                  Includes statuses such as failed, error, errored, and similar.
                </p>
              </InfoTip>
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "@container/card border-border/60 shadow-sm",
            healthError && "border-amber-500/30 bg-amber-500/[0.03]"
          )}
        >
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>App health</CardDescription>
            <Activity
              className={cn(
                "size-4",
                healthError
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
              aria-hidden
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {healthLoading ? (
              <div className="flex gap-6">
                <ValueShimmer className="h-9 w-[3ch]" />
                <ValueShimmer className="h-9 w-[3ch]" />
              </div>
            ) : healthError ? (
              <p className="text-amber-800 text-sm dark:text-amber-200">
                {healthError}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                  <div>
                    <div className="text-3xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {health?.live ?? 0}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">Live</p>
                  </div>
                  <div>
                    <div className="text-3xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      {health?.degraded ?? 0}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Degraded
                    </p>
                  </div>
                </div>
                <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                  {health && health.total > 0 ? (
                    <span>
                      Snapshot:{" "}
                      {format(new Date(health.checkedAt), "PPp")}
                    </span>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span>No backends configured for health checks yet.</span>
                      <InfoTip label="How to add probes">
                        <p>
                          Calls <code>app_base_url</code>/health for each Slack
                          installation row that has <code>app_base_url</code>. You
                          can also add <code>HEALTH_CHECK_URLS</code> for extra
                          endpoints.
                        </p>
                      </InfoTip>
                    </span>
                  )}
                  <Link
                    href="/dashboard?tab=health"
                    className="text-primary font-medium hover:underline"
                  >
                    Open full health report
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart + queued — horizontal on xl */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
        <Card className="min-w-0 flex-1 border-border/60 shadow-sm xl:min-h-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers3 className="size-5" />
              Jobs by status
            </CardTitle>
            <CardDescription className="flex flex-wrap items-start gap-1.5">
              {loading ? (
                <ValueShimmer className="inline-block h-4 w-[min(100%,18rem)]" />
              ) : (
                <>
                  <span>
                    <span className="font-medium text-foreground">
                      {s?.jobs.total}
                    </span>{" "}
                    jobs across core, messages, and Atlas. The chart is the last
                    7 days.
                  </span>
                  <InfoTip label="How this chart is built">
                    <p>
                      The filled areas show combined status totals across all job
                      pipelines. The lines show per-day volume for core jobs,
                      message jobs, and Atlas sync jobs on their own scale.
                    </p>
                    <p>
                      Optional detail: buckets align to calendar-day boundaries in
                      the database time zone.
                    </p>
                  </InfoTip>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !s ? (
              <ChartAreaShimmer />
            ) : (
              <div className="space-y-3">
                <ChartContainer
                  id="jobs-7d"
                  config={jobsStatusChartConfig}
                  className="h-[320px] w-full [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border"
                >
                  <ComposedChart
                    accessibilityLayer
                    data={jobsTimeSeriesData}
                    margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval="preserveStartEnd"
                      minTickGap={20}
                    />
                    <YAxis yAxisId="status" allowDecimals={false} width={36} />
                    <YAxis yAxisId="sources" hide allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      yAxisId="status"
                      type="monotone"
                      dataKey="queued"
                      stackId="jobs"
                      stroke="var(--color-queued)"
                      fill="var(--color-queued)"
                      fillOpacity={0.55}
                    />
                    <Area
                      yAxisId="status"
                      type="monotone"
                      dataKey="failed"
                      stackId="jobs"
                      stroke="var(--color-failed)"
                      fill="var(--color-failed)"
                      fillOpacity={0.55}
                    />
                    <Area
                      yAxisId="status"
                      type="monotone"
                      dataKey="completed"
                      stackId="jobs"
                      stroke="var(--color-completed)"
                      fill="var(--color-completed)"
                      fillOpacity={0.55}
                    />
                    <Line
                      yAxisId="sources"
                      type="monotone"
                      dataKey="jobs"
                      stroke="var(--color-jobs)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="sources"
                      type="monotone"
                      dataKey="messages"
                      stroke="var(--color-messages)"
                      strokeWidth={2.5}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="sources"
                      type="monotone"
                      dataKey="atlas"
                      stroke="var(--color-atlas)"
                      strokeWidth={2.5}
                      strokeDasharray="3 4"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ChartContainer>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-1 pt-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-foreground text-xs font-medium">
                      Status
                    </span>
                    <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                      <LegendDot color="hsl(38 92% 45%)" />
                      <span>Queued</span>
                    </div>
                    <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                      <LegendDot color="hsl(0 72% 51%)" />
                      <span>Failed</span>
                    </div>
                    <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                      <LegendDot color="hsl(142 71% 40%)" />
                      <span>Completed</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-foreground text-xs font-medium">
                      Sources
                    </span>
                    <SourceLegendItem
                      label="Ticket Jobs"
                      color="hsl(210 90% 60%)"
                    />
                    <SourceLegendItem
                      label="Messages"
                      color="hsl(262 83% 66%)"
                      dashed
                    />
                    <SourceLegendItem
                      label="Atlas"
                      color="hsl(188 78% 45%)"
                      dashed
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex w-full flex-col border-border/60 shadow-sm xl:max-w-md xl:shrink-0">
          <CardHeader>
            <CardTitle className="text-lg">Queued</CardTitle>
            <CardDescription className="flex flex-wrap items-start gap-1.5">
              <span>Jobs that are not finished yet.</span>
              <InfoTip label="Included states">
                <p>
                  Anything that is not counted as completed or failed — for example
                  Bull or BullMQ states like waiting, active, or delayed.
                </p>
              </InfoTip>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="flex items-baseline gap-2">
              {loading ? (
                <ValueShimmer className="h-11 w-[4ch] min-w-[4rem]" />
              ) : (
                <span className="text-4xl font-semibold tabular-nums">
                  {s?.jobs.queued}
                </span>
              )}
              <Loader2 className="size-6 shrink-0 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Still running or waiting in the queue.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
