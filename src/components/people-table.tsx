"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowDownAZ,
  Bot,
  Eye,
  Mail,
  RefreshCw,
  Search,
  UserCircle2,
  Users,
  Hash,
  Building2,
  Clock,
  Filter,
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
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InfoTip } from "@/components/info-tip";
import { PageHeading } from "@/components/page-heading";
import { PeopleUserDetail } from "@/components/people-user-detail";
import { cn } from "@/lib/utils";

export type UserRecord = {
  slack_user_id: string;
  slack_team_id: string;
  email: string | null;
  requester_id: string | null;
  safeserv_active: boolean | null;
  digispace_active: boolean | null;
  is_agent: boolean | null;
  agent_requester_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  atlas_last_sync: string | null;
};

const PAGE_SIZE = 30;

type Tri = "any" | "yes" | "no";

type PeopleAppView = "all" | "safeserv" | "digispace";

const APP_VIEW_OPTIONS: {
  id: PeopleAppView;
  label: string;
  hint: string;
}[] = [
  { id: "all", label: "All", hint: "Show everyone in the directory" },
  { id: "safeserv", label: "SafeServ", hint: "Show users active on SafeServ" },
  { id: "digispace", label: "Digispace", hint: "Show users active on Digispace" },
];

function buildUsersQuery(params: {
  limit: number;
  offset: number;
  q: string;
  slackUserId: string;
  requesterId: string;
  hasEmail: Tri;
  safeservFilter: "all" | "safeserv";
  digispaceFilter: "all" | "digispace";
  agentFilter: Tri;
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
  if (params.safeservFilter === "safeserv") p.set("safeserv_active", "yes");
  if (params.digispaceFilter === "digispace") p.set("digispace_active", "yes");
  if (params.agentFilter === "yes") p.set("is_agent", "yes");
  if (params.agentFilter === "no") p.set("is_agent", "no");
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
  const [appView, setAppView] = React.useState<PeopleAppView>("all");
  const [hasEmail, setHasEmail] = React.useState<Tri>("any");
  const [agentFilter, setAgentFilter] = React.useState<Tri>("any");
  const [sort, setSort] = React.useState<UserListSort>("updated_at_desc");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<{
    slackUserId: string;
    slackTeamId: string;
  } | null>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 380);
    return () => window.clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    setPage(0);
  }, [
    qDebounced,
    slackUserIdFilter,
    requesterIdFilter,
    appView,
    hasEmail,
    agentFilter,
    sort,
  ]);

  const safeservFilter = appView === "safeserv" ? "safeserv" : "all";
  const digispaceFilter = appView === "digispace" ? "digispace" : "all";

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
          safeservFilter,
          digispaceFilter,
          agentFilter,
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
      safeservFilter,
      digispaceFilter,
      agentFilter,
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
    setAppView("all");
    setHasEmail("any");
    setAgentFilter("any");
    setSort("updated_at_desc");
  };

  const openDetail = React.useCallback((user: UserRecord) => {
    setSelectedUser({
      slackUserId: user.slack_user_id,
      slackTeamId: user.slack_team_id,
    });
    setDetailOpen(true);
  }, []);

  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeading
        icon={Users}
        title="People"
        description={
          <>
            <span>Search and open people in your directory.</span>
            <InfoTip label="About this data">
              <p>
                Stored in <code>public.users</code>. Use the app switcher to slide
                between all users, SafeServ users, and Digispace users.
              </p>
            </InfoTip>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="inline-flex min-w-0 max-w-full items-center rounded-2xl border border-border/60 bg-muted/30 p-1">
            {APP_VIEW_OPTIONS.map(({ id, label, hint }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={appView === id ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-10 rounded-xl px-4 text-sm font-medium",
                      appView !== id && "text-muted-foreground"
                    )}
                    onClick={() => {
                      setAppView(id);
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
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl px-4"
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
              placeholder="Search user, email, team, requester, agent IDs, workspaces…"
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
              <Label className="text-xs text-muted-foreground">Agent</Label>
              <Select
                value={agentFilter}
                onValueChange={(v) => {
                  setAgentFilter(v as Tri);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-10 w-[158px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Agent mode</SelectItem>
                  <SelectItem value="no">Not agent</SelectItem>
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
            <Table className="min-w-[1180px]">
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
                  <TableHead className="min-w-[100px] font-semibold">
                    SafeServ
                  </TableHead>
                  <TableHead className="min-w-[100px] font-semibold">
                    Digispace
                  </TableHead>
                  <TableHead className="min-w-[100px] font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Bot className="size-3.5 opacity-70" />
                      Agent
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[140px] font-semibold">
                    Created
                  </TableHead>
                  <TableHead className="min-w-[140px] font-semibold">
                    Atlas sync
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
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
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
                      colSpan={12}
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
                        <code className="inline-flex w-fit max-w-full items-center rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[13px]">
                          <span className="truncate">{u.slack_user_id}</span>
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
                        {u.safeserv_active === true ? (
                          <Badge className="font-normal">Active</Badge>
                        ) : u.safeserv_active === false ? (
                          <Badge variant="secondary" className="font-normal">
                            Off
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.digispace_active === true ? (
                          <Badge className="font-normal">Active</Badge>
                        ) : u.digispace_active === false ? (
                          <Badge variant="secondary" className="font-normal">
                            Off
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.is_agent === true ? (
                          <Badge className="font-normal">
                            <Bot className="mr-1 size-3" />
                            Yes
                          </Badge>
                        ) : u.is_agent === false ? (
                          <Badge variant="secondary" className="font-normal">
                            No
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.created_at ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground inline-flex cursor-default items-center gap-1.5 text-sm">
                                <Clock className="size-3.5" />
                                {formatDistanceToNow(new Date(u.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-mono text-xs">
                              {format(new Date(u.created_at), "PPpp")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.atlas_last_sync ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-default items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                                <Clock className="size-3.5 opacity-80" />
                                {formatDistanceToNow(
                                  new Date(u.atlas_last_sync),
                                  { addSuffix: true }
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-mono text-xs">
                              {format(new Date(u.atlas_last_sync), "PPpp")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
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
                          onClick={() => openDetail(u)}
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
            Primary key:{" "}
            <code className="text-foreground">(slack_user_id, slack_team_id)</code>
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

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-l border-border/60 bg-background sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-border/60 px-6 py-5">
            <SheetTitle>Person detail</SheetTitle>
            <SheetDescription>
              Review and edit user fields without leaving the People page.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 py-5">
            {selectedUser ? (
              <PeopleUserDetail
                slackUserId={selectedUser.slackUserId}
                slackTeamId={selectedUser.slackTeamId}
                embedded
                onClose={() => setDetailOpen(false)}
                onSaved={(updatedUser) =>
                  setUsers((current) =>
                    current.map((user) =>
                      user.slack_user_id === updatedUser.slack_user_id &&
                      user.slack_team_id === updatedUser.slack_team_id
                        ? updatedUser
                        : user
                    )
                  )
                }
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
