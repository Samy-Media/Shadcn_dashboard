"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowDownAZ,
  CalendarRange,
  Filter,
  Hash,
  Layers,
  Eye,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import type { JobRow } from "@/lib/operations-queries";
import { InfoTip } from "@/components/info-tip";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

type JobSort = "created_at_desc" | "created_at_asc" | "updated_at_desc" | "updated_at_asc";

type StatusGroup = "all" | "completed" | "failed" | "queued";

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase().trim();
  if (["completed", "success", "succeeded", "complete"].includes(s)) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (["failed", "failure", "error", "errored"].includes(s)) {
    return "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200";
  }
  return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
}

function toIsoEndOfDay(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function buildJobsQuery(params: {
  limit: number;
  offset: number;
  sort: JobSort;
  statusGroup: StatusGroup;
  statusIn: string[];
  q: string;
  jobType: string;
  bullJobId: string;
  slackUserId: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
  hasError: "any" | "yes" | "no";
}): string {
  const p = new URLSearchParams();
  p.set("limit", String(params.limit));
  p.set("offset", String(params.offset));
  p.set("sort", params.sort);
  if (params.q.trim()) p.set("q", params.q.trim());
  if (params.jobType.trim()) p.set("job_type", params.jobType.trim());
  if (params.bullJobId.trim()) p.set("bull_job_id", params.bullJobId.trim());
  if (params.slackUserId.trim()) p.set("slack_user_id", params.slackUserId.trim());
  if (params.statusIn.length) {
    p.set("status_in", params.statusIn.join(","));
  } else if (params.statusGroup !== "all") {
    p.set("status_group", params.statusGroup);
  }
  if (params.createdFrom) p.set("created_from", new Date(params.createdFrom).toISOString());
  if (params.createdTo) {
    const iso = toIsoEndOfDay(params.createdTo);
    if (iso) p.set("created_to", iso);
  }
  if (params.updatedFrom) p.set("updated_from", new Date(params.updatedFrom).toISOString());
  if (params.updatedTo) {
    const iso = toIsoEndOfDay(params.updatedTo);
    if (iso) p.set("updated_to", iso);
  }
  if (params.hasError === "yes") p.set("has_error", "true");
  if (params.hasError === "no") p.set("has_error", "false");
  return p.toString();
}

export function JobsPanel() {
  const [jobs, setJobs] = React.useState<JobRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [facets, setFacets] = React.useState<{ jobTypes: string[]; statuses: string[] }>({
    jobTypes: [],
    statuses: [],
  });

  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<JobSort>("created_at_desc");
  const [statusGroup, setStatusGroup] = React.useState<StatusGroup>("all");
  const [statusPick, setStatusPick] = React.useState<string[]>([]);
  const [q, setQ] = React.useState("");
  const [qDebounced, setQDebounced] = React.useState("");
  const [jobType, setJobType] = React.useState("");
  const [bullJobId, setBullJobId] = React.useState("");
  const [slackUserId, setSlackUserId] = React.useState("");
  const [createdFrom, setCreatedFrom] = React.useState("");
  const [createdTo, setCreatedTo] = React.useState("");
  const [updatedFrom, setUpdatedFrom] = React.useState("");
  const [updatedTo, setUpdatedTo] = React.useState("");
  const [hasError, setHasError] = React.useState<"any" | "yes" | "no">("any");

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<JobRow | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/jobs/facets");
        const j = await r.json();
        if (r.ok && j.success) setFacets(j.data);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 380);
    return () => window.clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    setPage(0);
  }, [qDebounced]);

  const fetchJobs = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildJobsQuery({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sort,
        statusGroup: statusPick.length ? "all" : statusGroup,
        statusIn: statusPick,
        q: qDebounced,
        jobType,
        bullJobId,
        slackUserId,
        createdFrom,
        createdTo,
        updatedFrom,
        updatedTo,
        hasError,
      });
      const res = await fetch(`/api/jobs?${qs}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Failed");
      setJobs(json.data as JobRow[]);
      setTotal(Number(json.total ?? 0));
    } catch {
      setJobs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    sort,
    statusGroup,
    statusPick,
    qDebounced,
    jobType,
    bullJobId,
    slackUserId,
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    hasError,
  ]);

  React.useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setSheetOpen(true);
  };

  React.useEffect(() => {
    if (!sheetOpen || !selectedId) return;
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(selectedId)}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error();
        if (!cancelled) setDetail(json.data as JobRow);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sheetOpen, selectedId]);

  const resetFilters = () => {
    setPage(0);
    setSort("created_at_desc");
    setStatusGroup("all");
    setStatusPick([]);
    setQ("");
    setQDebounced("");
    setJobType("");
    setBullJobId("");
    setSlackUserId("");
    setCreatedFrom("");
    setCreatedTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setHasError("any");
  };

  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleStatus = (s: string) => {
    setStatusPick((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <PageHeading
        icon={Layers}
        title="Jobs"
        description={
          <>
            <span>Browse background jobs, results, and errors.</span>
            <InfoTip label="About this data">
              <p>
                Rows come from <code>public.jobs</code>. Open a job to inspect{" "}
                <code>result</code> JSON and error messages.
              </p>
            </InfoTip>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="inline-flex min-w-0 max-w-full items-center rounded-2xl border border-border/60 bg-muted/30 p-1">
          {(
            [
              ["all", "All"],
              ["completed", "Completed"],
              ["failed", "Failed"],
              ["queued", "Queued / active"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              variant={statusGroup === id && !statusPick.length ? "default" : "ghost"}
              size="sm"
              className="h-10 rounded-xl px-4 text-sm font-medium"
              onClick={() => {
                setStatusGroup(id);
                setStatusPick([]);
                setPage(0);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl px-4"
            onClick={() => void fetchJobs()}
            disabled={loading}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 rounded-xl px-4 text-muted-foreground"
            onClick={resetFilters}
          >
            Reset filters
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search type, status, Bull id, error text, UUID, Slack user id…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 rounded-xl border-border/60 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sort</Label>
              <Select
                value={sort}
                onValueChange={(v) => {
                  setSort(v as JobSort);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-10 w-[200px] rounded-xl">
                  <ArrowDownAZ className="mr-1 size-3.5 opacity-60" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at_desc">Created · newest</SelectItem>
                  <SelectItem value="created_at_asc">Created · oldest</SelectItem>
                  <SelectItem value="updated_at_desc">Updated · newest</SelectItem>
                  <SelectItem value="updated_at_asc">Updated · oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Errors</Label>
              <Select
                value={hasError}
                onValueChange={(v) => {
                  setHasError(v as "any" | "yes" | "no");
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-10 w-[130px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Has error</SelectItem>
                  <SelectItem value="no">No error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Collapsible className="mt-4">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between rounded-xl border-dashed"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4" />
                Advanced filters
              </span>
              <Filter className="size-4 opacity-60" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4 data-[state=closed]:animate-none">
            {facets.statuses.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Exact statuses (optional — overrides quick bucket)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {facets.statuses.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s.toLowerCase())}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        statusPick.includes(s.toLowerCase())
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 bg-background/80 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs">Job type contains</Label>
                <Input
                  value={jobType}
                  onChange={(e) => {
                    setJobType(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Substring match"
                  className="h-9 rounded-lg"
                />
                {facets.jobTypes.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {facets.jobTypes.slice(0, 16).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setJobType(t);
                          setPage(0);
                        }}
                        className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {t.length > 36 ? `${t.slice(0, 34)}…` : t}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bull job id contains</Label>
                <Input
                  value={bullJobId}
                  onChange={(e) => {
                    setBullJobId(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Substring match"
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Slack user id (exact)</Label>
                <Input
                  value={slackUserId}
                  onChange={(e) => {
                    setSlackUserId(e.target.value);
                    setPage(0);
                  }}
                  placeholder="U…"
                  className="h-9 rounded-lg font-mono text-sm"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-xs">
                  <CalendarRange className="size-3" />
                  Created from
                </Label>
                <Input
                  type="datetime-local"
                  value={createdFrom}
                  onChange={(e) => {
                    setCreatedFrom(e.target.value);
                    setPage(0);
                  }}
                  className="h-9 rounded-lg font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Created to</Label>
                <Input
                  type="datetime-local"
                  value={createdTo}
                  onChange={(e) => {
                    setCreatedTo(e.target.value);
                    setPage(0);
                  }}
                  className="h-9 rounded-lg font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Updated from</Label>
                <Input
                  type="datetime-local"
                  value={updatedFrom}
                  onChange={(e) => {
                    setUpdatedFrom(e.target.value);
                    setPage(0);
                  }}
                  className="h-9 rounded-lg font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Updated to</Label>
                <Input
                  type="datetime-local"
                  value={updatedTo}
                  onChange={(e) => {
                    setUpdatedTo(e.target.value);
                    setPage(0);
                  }}
                  className="h-9 rounded-lg font-mono text-xs"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm">
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs">
          <span>
            Showing{" "}
            <span className="text-foreground font-medium">
              {loading ? "…" : `${start}–${end}`}
            </span>{" "}
            of <span className="text-foreground font-medium">{loading ? "…" : total}</span>{" "}
            jobs
          </span>
          <span className="flex items-center gap-1">
            <Hash className="size-3" />
            Page {page + 1} / {totalPages}
          </span>
        </div>
        <div className="px-2 pb-2 pt-2 sm:px-3">
          <ScrollArea className="h-[min(65vh,680px)] w-full rounded-xl border border-border/40 bg-background/40">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[100px] pl-4 font-semibold">
                    Type
                  </TableHead>
                  <TableHead className="min-w-[90px] font-semibold">Status</TableHead>
                  <TableHead className="min-w-[100px] font-semibold">Bull id</TableHead>
                  <TableHead className="min-w-[120px] font-semibold">Slack users</TableHead>
                  <TableHead className="min-w-[130px] font-semibold">Created</TableHead>
                  <TableHead className="w-[100px] pr-4 text-right font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-4">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Skeleton className="ml-auto h-8 w-16" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-48 text-center text-muted-foreground"
                    >
                      No jobs match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => (
                    <TableRow
                      key={j.id}
                      className="cursor-pointer border-border/40 hover:bg-muted/50"
                      onClick={() => openDetail(j.id)}
                    >
                      <TableCell className="max-w-[200px] pl-4">
                        <span className="line-clamp-2 font-medium">{j.job_type}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("font-normal", statusBadgeClass(j.status))}
                        >
                          {j.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {j.bull_job_id ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs">
                        {j.slack_user_ids?.length
                          ? j.slack_user_ids.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {j.created_at ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">
                                {formatDistanceToNow(new Date(j.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="font-mono text-xs">
                              {format(new Date(j.created_at), "PPpp")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(j.id);
                          }}
                        >
                          <Eye className="mr-1 size-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={loading || page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={loading || (page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto border-l bg-background/95 p-0 backdrop-blur sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-6 text-left">
            <SheetTitle className="font-mono text-base">Job detail</SheetTitle>
            <SheetDescription className="font-mono text-xs break-all">
              {selectedId}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-6 px-6 py-6">
            {detailLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : detail ? (
              <>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2">
                    <span className="text-muted-foreground">Job type</span>
                    <span className="font-medium">{detail.job_type}</span>
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant="outline"
                      className={cn("w-fit font-normal", statusBadgeClass(detail.status))}
                    >
                      {detail.status}
                    </Badge>
                    <span className="text-muted-foreground">Bull job id</span>
                    <span className="font-mono text-xs">{detail.bull_job_id ?? "—"}</span>
                    <span className="text-muted-foreground">Slack user ids</span>
                    <span className="font-mono text-xs break-all">
                      {detail.slack_user_ids?.length
                        ? detail.slack_user_ids.join(", ")
                        : "—"}
                    </span>
                    <span className="text-muted-foreground">Created</span>
                    <span>
                      {detail.created_at
                        ? format(new Date(detail.created_at), "PPpp")
                        : "—"}
                    </span>
                    <span className="text-muted-foreground">Updated</span>
                    <span>
                      {detail.updated_at
                        ? format(new Date(detail.updated_at), "PPpp")
                        : "—"}
                    </span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Error message
                  </p>
                  <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap">
                    {detail.error_message ?? "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Result (JSON)
                  </p>
                  <ScrollArea className="max-h-[min(50vh,400px)] rounded-lg border bg-muted/20 p-3">
                    <pre className="text-xs leading-relaxed break-words whitespace-pre-wrap font-mono">
                      {detail.result != null
                        ? JSON.stringify(detail.result, null, 2)
                        : "null"}
                    </pre>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Could not load job.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
