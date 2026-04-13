"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowDownAZ,
  Clock,
  Eye,
  Hash,
  LayoutGrid,
  MessageSquare,
  RefreshCw,
  Search,
} from "lucide-react";

import type {
  SlackMessageJobRow,
  SlackMessageJobSort,
} from "@/lib/operations-queries";
import { InfoTip } from "@/components/info-tip";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type StatusGroup = "all" | "queued" | "completed" | "failed";

/** Slack `channel` field: user destinations U…, public channels C… */
type MessageChannelKindFilter = "all" | "user" | "channel";

const CHANNEL_KIND_PILLS: {
  id: MessageChannelKindFilter;
  label: string;
  hint: string;
}[] = [
  {
    id: "all",
    label: "All messages",
    hint: "Every job regardless of destination id prefix",
  },
  {
    id: "user",
    label: "User",
    hint: "Destination id starts with U (e.g. U04F6M4RWJU)",
  },
  {
    id: "channel",
    label: "Channel",
    hint: "Destination id starts with C (e.g. C09FNJSMNRM)",
  },
];

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase().trim();
  if (
    ["sent", "delivered", "success", "completed", "succeeded", "ok", "done"].includes(
      s
    )
  ) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (["failed", "failure", "error", "errored"].includes(s)) {
    return "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200";
  }
  return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
}

function previewText(text: string | null, max = 80): string {
  if (!text?.trim()) return "—";
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function buildQuery(params: {
  limit: number;
  offset: number;
  sort: SlackMessageJobSort;
  statusGroup: StatusGroup;
  channelKind: MessageChannelKindFilter;
  q: string;
  channel: string;
  bullJobId: string;
  hasError: "any" | "yes" | "no";
}): string {
  const p = new URLSearchParams();
  p.set("limit", String(params.limit));
  p.set("offset", String(params.offset));
  p.set("sort", params.sort);
  if (params.q.trim()) p.set("q", params.q.trim());
  if (params.channel.trim()) p.set("channel", params.channel.trim());
  if (params.bullJobId.trim()) p.set("bull_job_id", params.bullJobId.trim());
  if (params.statusGroup !== "all") {
    p.set("status_group", params.statusGroup);
  }
  if (params.channelKind === "user") p.set("channel_kind", "user");
  if (params.channelKind === "channel") p.set("channel_kind", "channel");
  if (params.hasError === "yes") p.set("has_error", "true");
  if (params.hasError === "no") p.set("has_error", "false");
  return p.toString();
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[160px_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 break-all font-medium",
          mono && "font-mono text-[13px]"
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

export function MessagesPanel() {
  const [rows, setRows] = React.useState<SlackMessageJobRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [sort, setSort] =
    React.useState<SlackMessageJobSort>("created_at_desc");
  const [statusGroup, setStatusGroup] = React.useState<StatusGroup>("all");
  const [channelKind, setChannelKind] =
    React.useState<MessageChannelKindFilter>("all");
  const [q, setQ] = React.useState("");
  const [qDebounced, setQDebounced] = React.useState("");
  const [channel, setChannel] = React.useState("");
  const [bullJobId, setBullJobId] = React.useState("");
  const [hasError, setHasError] = React.useState<"any" | "yes" | "no">("any");

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<SlackMessageJobRow | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 380);
    return () => window.clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    setPage(0);
  }, [
    qDebounced,
    statusGroup,
    channelKind,
    channel,
    bullJobId,
    hasError,
    sort,
  ]);

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQuery({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sort,
        statusGroup,
        channelKind,
        q: qDebounced,
        channel,
        bullJobId,
        hasError,
      });
      const res = await fetch(`/api/slack-message-jobs?${qs}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Failed to load messages");
      }
      setRows(json.data as SlackMessageJobRow[]);
      setTotal(Number(json.total ?? 0));
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    page,
    sort,
    statusGroup,
    channelKind,
    qDebounced,
    channel,
    bullJobId,
    hasError,
  ]);

  React.useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const refresh = () => {
    setRefreshing(true);
    void fetchRows();
  };

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
        const res = await fetch(
          `/api/slack-message-jobs/${encodeURIComponent(selectedId)}`
        );
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error();
        if (!cancelled) setDetail(json.data as SlackMessageJobRow);
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
    setChannelKind("all");
    setQ("");
    setQDebounced("");
    setChannel("");
    setBullJobId("");
    setHasError("any");
  };

  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const show = detail ?? rows.find((r) => r.id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeading
        icon={MessageSquare}
        title="Messages"
        description={
          <>
            <span>Search and filter Slack message jobs.</span>
            <InfoTip label="About this data">
              <p>
                Rows come from <code>public.slack_message_jobs</code>. Filters work
                like People. Destination channels use Slack IDs: <code>U…</code>{" "}
                for users, <code>C…</code> for channels.
              </p>
            </InfoTip>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium">
            <LayoutGrid className="size-3.5 opacity-70" aria-hidden />
            Target
          </span>
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-1">
            {CHANNEL_KIND_PILLS.map(({ id, label, hint }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={channelKind === id ? "default" : "ghost"}
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs"
                    onClick={() => {
                      setChannelKind(id);
                      setPage(0);
                    }}
                  >
                    {label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                  {hint}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            onClick={() => refresh()}
            disabled={loading || refreshing}
          >
            <RefreshCw
              className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg text-muted-foreground"
            onClick={resetFilters}
          >
            Reset filters
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search channel, text, status, Bull id, error…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 rounded-xl border-border/60 pl-9"
            />
          </div>
          <Input
            placeholder="Channel contains"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="h-10 rounded-xl border-border/60 font-mono text-sm"
          />
          <Input
            placeholder="Bull job ID"
            value={bullJobId}
            onChange={(e) => setBullJobId(e.target.value)}
            className="h-10 rounded-xl border-border/60 font-mono text-sm"
          />
          <Select
            value={statusGroup}
            onValueChange={(v) => {
              setStatusGroup(v as StatusGroup);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="queued">In flight</SelectItem>
              <SelectItem value="completed">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
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
                <SelectItem value="any">Any error</SelectItem>
                <SelectItem value="yes">Has error</SelectItem>
                <SelectItem value="no">No error</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v as SlackMessageJobSort);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-10 min-w-[200px] rounded-xl">
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
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm">
        <div className="text-muted-foreground relative flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs">
          <span>
            Showing{" "}
            <span className="text-foreground font-medium">
              {loading ? "…" : total === 0 ? "0" : `${start}–${end}`}
            </span>{" "}
            of{" "}
            <span className="text-foreground font-medium">
              {loading ? "…" : total}
            </span>{" "}
            jobs
          </span>
          <span className="flex items-center gap-1">
            <Hash className="size-3" />
            Page {page + 1} / {totalPages}
          </span>
        </div>
        <div className="relative px-2 pb-2 pt-2 sm:px-3">
          <ScrollArea className="h-[min(70vh,720px)] w-full rounded-xl border border-muted-foreground/15 bg-card/50">
            <Table className="min-w-[900px] table-fixed">
              <TableHeader>
                <TableRow className="border-muted-foreground/15 hover:bg-transparent">
                  <TableHead className="w-[14%] font-semibold">Channel</TableHead>
                  <TableHead className="w-[32%] font-semibold">Message</TableHead>
                  <TableHead className="w-[10%] font-semibold">Status</TableHead>
                  <TableHead className="w-[12%] font-semibold">Bull job</TableHead>
                  <TableHead className="w-[14%] font-semibold">Created</TableHead>
                  <TableHead className="w-[10%] pr-6 text-right font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-muted-foreground/10">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j} className="max-w-0">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground h-48 text-center"
                    >
                      No message jobs match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="border-muted-foreground/10 hover:bg-muted/40"
                    >
                      <TableCell className="max-w-0 align-middle">
                        <code
                          className="block truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs"
                          title={r.channel}
                        >
                          {r.channel}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-0 align-middle">
                        <span className="text-muted-foreground block truncate text-sm">
                          {previewText(r.message_text, 120)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-0 align-middle">
                        <Badge
                          variant="outline"
                          className={cn(
                            "max-w-full truncate font-mono text-xs font-normal",
                            statusBadgeClass(r.status)
                          )}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-0 align-middle">
                        {r.bull_job_id ? (
                          <code className="block truncate font-mono text-[11px]">
                            {r.bull_job_id}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-0 align-middle">
                        {r.created_at ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground inline-flex cursor-default items-center gap-1 text-xs">
                                <Clock className="size-3 shrink-0" />
                                <span className="truncate">
                                  {formatDistanceToNow(
                                    new Date(r.created_at),
                                    { addSuffix: true }
                                  )}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="font-mono text-xs">
                              {format(new Date(r.created_at), "PPpp")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-0 pr-6 text-right align-middle">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => openDetail(r.id)}
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

        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3 text-xs">
          <span>
            Primary key: <code className="text-foreground">id</code> (uuid)
          </span>
          <div className="flex flex-wrap gap-2">
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
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto border-l bg-background/95 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b px-6 py-5 text-left">
            <SheetTitle>Message job</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {selectedId ? selectedId : "—"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-6 py-6">
            {detailLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : show ? (
              <>
                <div className="space-y-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                  <DetailRow label="Channel" value={show.channel} mono />
                  <Separator />
                  <DetailRow label="Status" value={show.status} mono />
                  <Separator />
                  <DetailRow
                    label="Bull job ID"
                    value={show.bull_job_id}
                    mono
                  />
                  <Separator />
                  <DetailRow
                    label="Created"
                    value={
                      show.created_at
                        ? format(new Date(show.created_at), "PPpp")
                        : "—"
                    }
                  />
                  <Separator />
                  <DetailRow
                    label="Updated"
                    value={
                      show.updated_at
                        ? format(new Date(show.updated_at), "PPpp")
                        : "—"
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Message text
                  </Label>
                  <div className="bg-muted/40 max-h-48 overflow-auto rounded-xl border p-3 text-sm leading-relaxed">
                    {show.message_text?.trim() ? (
                      show.message_text
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                {show.error_message?.trim() ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-destructive">Error</Label>
                    <pre className="bg-destructive/5 text-destructive max-h-40 overflow-auto rounded-xl border border-destructive/20 p-3 text-xs leading-relaxed">
                      {show.error_message}
                    </pre>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    API result (JSON)
                  </Label>
                  <pre className="bg-muted/50 max-h-[min(50vh,320px)] overflow-auto rounded-xl border p-3 font-mono text-[11px] leading-relaxed">
                    {show.result != null
                      ? JSON.stringify(show.result, null, 2)
                      : "null"}
                  </pre>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Could not load row.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
