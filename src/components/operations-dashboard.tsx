"use client";

import * as React from "react";
import {
  KeyRound,
  Building2,
  CheckCircle2,
  Layers3,
  Loader2,
  PieChart,
  Users,
  XCircle,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

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
import { PageHeading } from "@/components/page-heading";
import { ValueShimmer } from "@/components/value-shimmer";

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
};

const chartConfig = {
  count: {
    label: "Jobs",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const STATUS_BAR_FILLS = [
  "hsl(38 92% 45%)",
  "hsl(0 72% 51%)",
  "hsl(142 71% 40%)",
] as const;

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

export function OperationsDashboard() {
  const [stats, setStats] = React.useState<StatsPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

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

  const chartData = React.useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Queued", count: stats.jobs.queued },
      { label: "Failed", count: stats.jobs.failed },
      { label: "Completed", count: stats.jobs.completed },
    ];
  }, [stats]);

  if (error && !stats) {
    return (
      <section className="space-y-6">
        <PageHeading
          icon={PieChart}
          title="Operations overview"
          description="Live counts from Postgres and Redis: users, workspaces, active sessions, and job pipeline health."
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
        description="Live counts from Postgres and Redis: users, workspaces, active sessions, and job pipeline health."
      />

      {/* KPI row — horizontal band */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
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
            <p className="text-muted-foreground mt-2 text-xs">
              Rows in <code className="text-[0.8rem]">public.users</code>
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
            <p className="text-muted-foreground mt-2 text-xs">
              Installations in{" "}
              <code className="text-[0.8rem]">public.slack_installation</code>
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
            <p className="text-muted-foreground mt-2 text-xs">
              Statuses: completed, success, succeeded
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
            <p className="text-muted-foreground mt-2 text-xs">
              Live count from <code className="text-[0.8rem]">/sessions/count</code>
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
            <p className="text-muted-foreground mt-2 text-xs">
              Statuses: failed, error, errored
            </p>
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
            <CardDescription>
              {loading ? (
                <ValueShimmer className="inline-block h-4 w-[min(100%,18rem)]" />
              ) : (
                <>
                  Total tracked:{" "}
                  <span className="font-medium text-foreground">
                    {s?.jobs.total}
                  </span>{" "}
                  — queued counts every non-terminal status (e.g. waiting,
                  active).
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !s ? (
              <ChartAreaShimmer />
            ) : (
              <ChartContainer
                config={chartConfig}
                className="aspect-auto min-h-[280px] w-full [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50"
              >
                <BarChart
                  accessibilityLayer
                  data={chartData}
                  margin={{ left: 8, right: 8, top: 8 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis allowDecimals={false} width={40} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar dataKey="count" radius={6}>
                    {chartData.map((_, i) => (
                      <Cell
                        key={chartData[i]?.label ?? i}
                        fill={STATUS_BAR_FILLS[i] ?? STATUS_BAR_FILLS[0]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="flex w-full flex-col border-border/60 shadow-sm xl:max-w-md xl:shrink-0">
          <CardHeader>
            <CardTitle className="text-lg">Queued</CardTitle>
            <CardDescription>Non-terminal job rows</CardDescription>
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
              Anything that is not counted as completed or failed — for example
              Bull/BullMQ states like{" "}
              <code className="text-xs">waiting</code>,{" "}
              <code className="text-xs">active</code>, or{" "}
              <code className="text-xs">delayed</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
