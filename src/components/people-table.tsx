"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowDownAZ,
  Mail,
  RefreshCw,
  Search,
  UserCircle2,
  Users,
  Eye,
  Hash,
  Building2,
  Clock,
  Filter,
  LayoutGrid,
  SlidersHorizontal,
} from "lucide-react";

import type { UserListSort } from "@/lib/operations-queries";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import { PageHeading } from "@/components/page-heading";
import { cn } from "@/lib/utils";

export type UserRecord = {
  slack_user_id: string;
  slack_team_id: string;
  email: string | null;
  requester_id: string | null;
  safserv_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  atlas_last_sync: string | null;
};

const PAGE_SIZE = 30;

type Tri = "any" | "yes" | "no";

/** Which integrated app to filter by (matches Jobs status bucket pattern). */
export type PeopleAppFilter = "all" | "safserv" | "not_safserv";

const APP_FILTER_PILLS: { id: PeopleAppFilter; label: string; hint: string }[] = [
  { id: "all", label: "All users", hint: "Everyone in the directory" },
  { id: "safserv", label: "Safserv", hint: "safserv_active is true" },
  { id: "not_safserv", label: "Not on Safserv", hint: "Inactive or not enrolled" },
];

function buildUsersQuery(params: {
  limit: number;
  offset: number;
  q: string;
  slackUserId: string;
  requesterId: string;
  hasEmail: Tri;
  appFilter: PeopleAppFilter;
  sort: UserListSort;
}): string {
  const p = new URLSearchParams();
  p.set("limit", String(params.limit));
  p.set("offset", String(params.offset));
  p.set("sort", params.sort);
  if (params.q.trim()) p.set("q", params.q.trim());
  if (params.slackUserId.trim()) p.set("slack_user_id", params.slackUserId.trim());
  if (params.requesterId.trim()) p.set("requester_id", params.requesterId.trim());
  if (params.hasEmail === "yes") p.set("has_email", "yes");
  if (params.hasEmail === "no") p.set("has_email", "no");
  if (params.appFilter === "safserv") p.set("safserv_active", "yes");
  if (params.appFilter === "not_safserv") p.set("safserv_active", "no");
  return p.toString();
}

function initialsFromUser(user: Pick<UserRecord, "email" | "slack_user_id">) {
  const e = user.email?.trim();
  if (e && e.includes("@")) {
    const local = e.split("@")[0] ?? "";
    const parts = local.replace(/[._-]+/g, " ").split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0] + parts[1]![0]).toUpperCase().slice(0, 2);
    }
    return local.slice(0, 2).toUpperCase() || "?";
  }
  return user.slack_user_id.replace(/^U/, "").slice(0, 2).toUpperCase() || "—";
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

export function ProductTable() {
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [q, setQ] = React.useState("");
  const [qDebounced, setQDebounced] = React.useState("");
  const [slackUserIdFilter, setSlackUserIdFilter] = React.useState("");
  const [requesterIdFilter, setRequesterIdFilter] = React.useState("");
  const [hasEmail, setHasEmail] = React.useState<Tri>("any");
  const [appFilter, setAppFilter] = React.useState<PeopleAppFilter>("all");
  const [sort, setSort] = React.useState<UserListSort>("updated_at_desc");

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<UserRecord | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 380);
    return () => window.clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    setPage(0);
  }, [qDebounced, slackUserIdFilter, requesterIdFilter, hasEmail, appFilter, sort]);

  const fetchUsers = React.useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const qs = buildUsersQuery({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          q: qDebounced,
          slackUserId: slackUserIdFilter,
          requesterId: requesterIdFilter,
          hasEmail,
          appFilter,
          sort,
        });
        const res = await fetch(`/api/users?${qs}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message ?? "Failed to load users");
        }
        setUsers(json.data as UserRecord[]);
        setTotal(Number(json.total ?? 0));
      } catch {
        setUsers([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      page,
      qDebounced,
      slackUserIdFilter,
      requesterIdFilter,
      hasEmail,
      appFilter,
      sort,
    ]
  );

  React.useEffect(() => {
    void fetchUsers(false);
  }, [fetchUsers]);

  const resetFilters = () => {
    setPage(0);
    setQ("");
    setQDebounced("");
    setSlackUserIdFilter("");
    setRequesterIdFilter("");
    setHasEmail("any");
    setAppFilter("all");
    setSort("updated_at_desc");
  };

  const openDetail = (slackUserId: string) => {
    setSelectedId(slackUserId);
    setDetail(null);
    setDetailError(null);
    setSheetOpen(true);
  };

  React.useEffect(() => {
    if (!sheetOpen || !selectedId) return;
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(
          `/api/users/${encodeURIComponent(selectedId)}`
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message ?? "Could not load user");
        }
        if (!cancelled) setDetail(json.data as UserRecord);
      } catch (e) {
        if (!cancelled) {
          setDetailError(e instanceof Error ? e.message : "Error");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sheetOpen, selectedId]);

  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const show = detail ?? users.find((u) => u.slack_user_id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeading
        icon={Users}
        title="People"
        description={
          <>
            Search and filter onboarded rows from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[0.8rem]">
              public.users
            </code>
            — same advanced pattern as Jobs.
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium">
            <LayoutGrid className="size-3.5 opacity-70" aria-hidden />
            App
          </span>
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-1">
            {APP_FILTER_PILLS.map(({ id, label, hint }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={appFilter === id ? "default" : "ghost"}
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs"
                    onClick={() => {
                      setAppFilter(id);
                      setPage(0);
                    }}
                  >
                    {label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-xs">
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
            onClick={() => void fetchUsers(true)}
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search Slack user ID, email, team, requester…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 rounded-xl border-border/60 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Select
                value={hasEmail}
                onValueChange={(v) => {
                  setHasEmail(v as Tri);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-10 w-[150px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Has email</SelectItem>
                  <SelectItem value="no">No email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sort</Label>
              <Select
                value={sort}
                onValueChange={(v) => {
                  setSort(v as UserListSort);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-10 w-[220px] rounded-xl">
                  <ArrowDownAZ className="mr-1 size-3.5 opacity-60" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_at_desc">Updated · newest</SelectItem>
                  <SelectItem value="updated_at_asc">Updated · oldest</SelectItem>
                  <SelectItem value="created_at_desc">Created · newest</SelectItem>
                  <SelectItem value="created_at_asc">Created · oldest</SelectItem>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Slack user ID (exact)</Label>
                <Input
                  value={slackUserIdFilter}
                  onChange={(e) => {
                    setSlackUserIdFilter(e.target.value);
                    setPage(0);
                  }}
                  placeholder="U…"
                  className="h-9 rounded-lg font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Requester ID (contains)</Label>
                <Input
                  value={requesterIdFilter}
                  onChange={(e) => {
                    setRequesterIdFilter(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Substring match"
                  className="h-9 rounded-lg font-mono text-sm"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_circle_at_0%_0%,hsl(var(--primary)/0.06),transparent_55%)]" />
        <div className="text-muted-foreground relative flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs">
          <span>
            Showing{" "}
            <span className="text-foreground font-medium">
              {loading ? "…" : total === 0 ? "0" : `${start}–${end}`}
            </span>{" "}
            of <span className="text-foreground font-medium">{loading ? "…" : total}</span>{" "}
            users
          </span>
          <span className="flex items-center gap-1">
            <Hash className="size-3" />
            Page {page + 1} / {totalPages}
          </span>
        </div>
        <div className="relative px-2 pb-2 pt-2 sm:px-3">
          <ScrollArea className="h-[min(70vh,720px)] w-full rounded-xl border border-muted-foreground/15 bg-card/50">
            <Table>
              <TableHeader>
                <TableRow className="border-muted-foreground/15 hover:bg-transparent">
                  <TableHead className="w-[52px] pl-6"> </TableHead>
                  <TableHead className="min-w-[140px] font-semibold">
                    Slack user
                  </TableHead>
                  <TableHead className="min-w-[200px] font-semibold">
                    Email
                  </TableHead>
                  <TableHead className="min-w-[120px] font-semibold">
                    Team
                  </TableHead>
                  <TableHead className="min-w-[100px] font-semibold">
                    Requester
                  </TableHead>
                  <TableHead className="min-w-[120px] font-semibold">
                    Safserv
                  </TableHead>
                  <TableHead className="min-w-[160px] font-semibold">
                    Updated
                  </TableHead>
                  <TableHead className="w-[100px] pr-6 text-right font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-muted-foreground/10">
                      <TableCell className="pl-6">
                        <Skeleton className="size-9 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Skeleton className="ml-auto h-9 w-20" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-64 text-center align-middle"
                    >
                      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 px-4">
                        <UserCircle2 className="size-10 opacity-40" />
                        <p className="text-sm">
                          No users match these filters.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow
                      key={u.slack_user_id}
                      className="border-muted-foreground/10 transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="pl-6">
                        <Avatar className="size-9 border border-muted-foreground/20 shadow-sm">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initialsFromUser(u)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <code className="rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[13px]">
                          {u.slack_user_id}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {u.email ? (
                          <span className="flex items-center gap-2">
                            <Mail className="text-muted-foreground size-3.5 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.slack_team_id.trim() ? (
                          <Badge
                            variant="secondary"
                            className="font-mono font-normal"
                          >
                            <Building2 className="mr-1 size-3" />
                            {u.slack_team_id}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.requester_id ? (
                          <span className="font-mono text-sm">
                            {u.requester_id}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.safserv_active === true ? (
                          <Badge className="font-normal">Active</Badge>
                        ) : u.safserv_active === false ? (
                          <Badge variant="secondary" className="font-normal">
                            Off
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.updated_at ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground inline-flex cursor-default items-center gap-1.5 text-sm">
                                <Clock className="size-3.5" />
                                {formatDistanceToNow(
                                  new Date(u.updated_at),
                                  { addSuffix: true }
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-mono text-xs">
                              {format(new Date(u.updated_at), "PPpp")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => openDetail(u.slack_user_id)}
                        >
                          <Eye className="mr-1.5 size-3.5" />
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

        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3 text-xs sm:px-6">
          <span className="flex items-center gap-1">
            <Hash className="size-3" />
            Primary key: <code className="text-foreground">slack_user_id</code>
          </span>
          <div className="flex flex-wrap items-center gap-2">
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
          className="flex w-full flex-col gap-0 overflow-y-auto border-l bg-background/95 p-0 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:max-w-lg"
        >
          <SheetHeader className="space-y-3 border-b bg-muted/30 px-6 py-6 text-left">
            <div className="flex items-start gap-4">
              <Avatar className="size-14 border-2 border-primary/20 shadow-md">
                <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
                  {show ? initialsFromUser(show) : "—"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <SheetTitle className="text-xl leading-tight">
                  User details
                </SheetTitle>
                <SheetDescription className="text-base">
                  {selectedId ? (
                    <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm text-foreground">
                      {selectedId}
                    </code>
                  ) : (
                    "Select a user"
                  )}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 px-6 py-6">
            {detailLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : detailError ? (
              <p className="text-destructive text-sm">{detailError}</p>
            ) : show ? (
              <>
                <div className="space-y-4">
                  <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Identity & workspace
                  </h3>
                  <div className="space-y-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                    <DetailRow
                      label="Slack user ID"
                      value={<span className="font-mono">{show.slack_user_id}</span>}
                      mono
                    />
                    <Separator />
                    <DetailRow label="Email" value={show.email} />
                    <Separator />
                    <DetailRow
                      label="Slack team ID"
                      value={show.slack_team_id || "—"}
                      mono
                    />
                    <Separator />
                    <DetailRow
                      label="Requester ID"
                      value={show.requester_id}
                      mono
                    />
                    <Separator />
                    <DetailRow
                      label="Safserv active"
                      value={
                        show.safserv_active === true
                          ? "Yes"
                          : show.safserv_active === false
                            ? "No"
                            : "—"
                      }
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
                </div>

                <div className="space-y-4">
                  <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Sync
                  </h3>
                  <div className="space-y-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                    <DetailRow
                      label="Atlas last sync"
                      value={
                        show.atlas_last_sync ? (
                          <span>
                            {format(
                              new Date(show.atlas_last_sync),
                              "PPpp"
                            )}{" "}
                            <span className="text-muted-foreground block text-xs font-normal sm:inline sm:before:content-['·_']">
                              (
                              {formatDistanceToNow(
                                new Date(show.atlas_last_sync),
                                { addSuffix: true }
                              )}
                              )
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never synced</span>
                        )
                      }
                    />
                  </div>
                </div>

                <p className="text-muted-foreground text-xs">
                  Data loaded from{" "}
                  <code className="rounded bg-muted px-1 py-0.5">GET</code>{" "}
                  <code className="break-all rounded bg-muted px-1 py-0.5 text-[11px]">
                    /api/users/
                    {selectedId ? encodeURIComponent(selectedId) : ""}
                  </code>
                </p>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
