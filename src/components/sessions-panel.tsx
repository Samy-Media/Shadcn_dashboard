"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownAZ,
  Clock3,
  Eye,
  Filter,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

type SessionValue = Record<string, unknown> | null;

type SessionRow = {
  namespace: string;
  teamId: string;
  userId: string;
  key: string;
  ttlSeconds: number | null;
  value: SessionValue;
};

type SessionsTreeResponse = {
  success: true;
  data: {
    total: number;
    returned: number;
    limit: number;
    sessions: Record<string, Record<string, Record<string, {
      key: string;
      ttlSeconds: number | null;
      value: SessionValue;
    }>>>;
  };
};

type SessionsCountResponse = {
  success: true;
  data: { total: number };
};

type SortKey = "ttl_desc" | "ttl_asc" | "team_asc" | "team_desc";
type Tri = "any" | "yes" | "no";

const PAGE_SIZE = 30;

function normalizeSessionValue(value: SessionValue): SessionValue {
  if (!value || typeof value !== "object") return null;
  const next: Record<string, unknown> = { ...value };

  const token =
    typeof next.token === "string" && next.token.trim() ? next.token.trim() : null;
  const digiToken =
    typeof next.digiSpaceAccessToken === "string" && next.digiSpaceAccessToken.trim()
      ? next.digiSpaceAccessToken.trim()
      : null;

  // Some sessions keep token in "token" while digiSpaceAccessToken is null.
  if (!digiToken && token) next.digiSpaceAccessToken = token;
  if (!token && digiToken) next.token = digiToken;

  return next;
}

function flattenTree(tree: SessionsTreeResponse["data"]["sessions"]): SessionRow[] {
  const rows: SessionRow[] = [];
  for (const [namespace, teams] of Object.entries(tree ?? {})) {
    for (const [teamId, users] of Object.entries(teams ?? {})) {
      for (const [userId, entry] of Object.entries(users ?? {})) {
        rows.push({
          namespace,
          teamId,
          userId,
          key: entry.key,
          ttlSeconds: typeof entry.ttlSeconds === "number" ? entry.ttlSeconds : null,
          value: normalizeSessionValue(
            entry.value && typeof entry.value === "object"
              ? (entry.value as Record<string, unknown>)
              : null
          ),
        });
      }
    }
  }
  return rows;
}

function hasAppToken(value: SessionValue): boolean {
  if (!value) return false;
  const token = typeof value.token === "string" ? value.token.trim() : "";
  const digiToken =
    typeof value.digiSpaceAccessToken === "string"
      ? value.digiSpaceAccessToken.trim()
      : "";
  return Boolean(token || digiToken);
}

function expiresText(ttlSeconds: number | null): string {
  if (ttlSeconds === null || ttlSeconds < 0) return "No TTL";
  const date = new Date(Date.now() + ttlSeconds * 1000);
  return formatDistanceToNow(date, { addSuffix: true });
}

export function SessionsPanel() {
  const [allRows, setAllRows] = React.useState<SessionRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [returned, setReturned] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);

  const [q, setQ] = React.useState<string>("");
  const [qDebounced, setQDebounced] = React.useState<string>("");
  const [teamIdFilter, setTeamIdFilter] = React.useState<string>("");
  const [userIdFilter, setUserIdFilter] = React.useState<string>("");
  const [hasToken, setHasToken] = React.useState<Tri>("any");
  const [sort, setSort] = React.useState<SortKey>("ttl_desc");
  const [page, setPage] = React.useState(0);

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SessionRow | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const fetchData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [treeRes, countRes] = await Promise.all([
        fetch("/api/sessions/tree?limit=500"),
        fetch("/api/sessions/count"),
      ]);
      const treeJson = (await treeRes.json()) as SessionsTreeResponse;
      const countJson = (await countRes.json()) as SessionsCountResponse;
      if (!treeRes.ok || !treeJson.success) throw new Error("Failed to load sessions");
      if (!countRes.ok || !countJson.success) throw new Error("Failed to load sessions count");

      const rows = flattenTree(treeJson.data.sessions);
      setAllRows(rows);
      setReturned(treeJson.data.returned ?? rows.length);
      setTotal(countJson.data.total ?? treeJson.data.total ?? rows.length);
    } catch {
      setAllRows([]);
      setReturned(0);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  const filtered = React.useMemo(() => {
    const qNorm = qDebounced.trim().toLowerCase();
    let rows = allRows.filter((r) => {
      if (teamIdFilter.trim() && !r.teamId.toLowerCase().includes(teamIdFilter.trim().toLowerCase())) {
        return false;
      }
      if (userIdFilter.trim() && !r.userId.toLowerCase().includes(userIdFilter.trim().toLowerCase())) {
        return false;
      }
      if (hasToken === "yes" && !hasAppToken(r.value)) return false;
      if (hasToken === "no" && hasAppToken(r.value)) return false;
      if (!qNorm) return true;
      const email = typeof r.value?.email === "string" ? r.value.email : "";
      return (
        r.teamId.toLowerCase().includes(qNorm) ||
        r.userId.toLowerCase().includes(qNorm) ||
        r.key.toLowerCase().includes(qNorm) ||
        email.toLowerCase().includes(qNorm)
      );
    });

    rows = [...rows].sort((a, b) => {
      if (sort === "ttl_desc") return (b.ttlSeconds ?? -1) - (a.ttlSeconds ?? -1);
      if (sort === "ttl_asc") return (a.ttlSeconds ?? 10 ** 9) - (b.ttlSeconds ?? 10 ** 9);
      if (sort === "team_desc") return b.teamId.localeCompare(a.teamId);
      return a.teamId.localeCompare(b.teamId);
    });
    return rows;
  }, [allRows, qDebounced, teamIdFilter, userIdFilter, hasToken, sort]);

  React.useEffect(() => {
    setPage(0);
  }, [qDebounced, teamIdFilter, userIdFilter, hasToken, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, filtered.length);

  const handleDeleteSession = React.useCallback(async () => {
    if (!selected) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: selected.key }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Failed to remove session");
      }
      setConfirmDeleteOpen(false);
      setSheetOpen(false);
      setSelected(null);
      await fetchData(true);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to remove session");
    } finally {
      setDeleteBusy(false);
    }
  }, [selected, fetchData]);

  return (
    <div className="space-y-6">
      <PageHeading
        icon={KeyRound}
        title="Sessions"
        description={
          <>
            <span>Browse sessions stored in Redis.</span>
            <InfoTip label="How this works">
              <p>
                Grouped and filtered in a similar way to People. The list is capped
                when loading for performance.
              </p>
            </InfoTip>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-1.5 text-xs text-muted-foreground">
          Total in Redis: <span className="font-semibold text-foreground">{total}</span>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-1.5 text-xs text-muted-foreground">
          Loaded: <span className="font-semibold text-foreground">{returned}</span> (limit 500)
        </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => void fetchData(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search team, user, email, key…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 rounded-xl border-border/60 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Token</Label>
              <Select value={hasToken} onValueChange={(v) => setHasToken(v as Tri)}>
                <SelectTrigger className="h-10 w-[150px] rounded-xl">
                  <SelectValue placeholder="Token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any token</SelectItem>
                  <SelectItem value="yes">Has token</SelectItem>
                  <SelectItem value="no">No token</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sort</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-10 w-[220px] rounded-xl">
                  <ArrowDownAZ className="mr-1 size-3.5 opacity-60" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ttl_desc">TTL · highest</SelectItem>
                  <SelectItem value="ttl_asc">TTL · lowest</SelectItem>
                  <SelectItem value="team_asc">Team · A-Z</SelectItem>
                  <SelectItem value="team_desc">Team · Z-A</SelectItem>
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
                <Label className="text-xs">Team ID</Label>
                <Input
                  placeholder="Substring match"
                  value={teamIdFilter}
                  onChange={(e) => setTeamIdFilter(e.target.value)}
                  className="h-9 rounded-lg font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">User ID</Label>
                <Input
                  placeholder="Substring match"
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                  className="h-9 rounded-lg font-mono text-sm"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm">
        <div className="text-muted-foreground relative flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs">
          <span>
            Showing{" "}
            <span className="text-foreground font-medium">
              {loading ? "…" : filtered.length === 0 ? "0" : `${start}–${end}`}
            </span>{" "}
            of <span className="text-foreground font-medium">{loading ? "…" : filtered.length}</span>{" "}
            loaded sessions
          </span>
          <span>Page {page + 1} / {totalPages}</span>
        </div>
        <div className="relative px-2 pb-2 pt-2 sm:px-3">
          <ScrollArea className="h-[min(70vh,720px)] w-full rounded-xl border border-muted-foreground/15 bg-card/50">
            <Table className="table-fixed w-full min-w-[720px]">
              <TableHeader>
                <TableRow className="border-muted-foreground/15 hover:bg-transparent">
                  <TableHead className="w-[10%] font-semibold">Team</TableHead>
                  <TableHead className="w-[11%] font-semibold">User</TableHead>
                  <TableHead className="w-[22%] font-semibold">Email</TableHead>
                  <TableHead className="w-[8%] font-semibold">Token</TableHead>
                  <TableHead className="w-[14%] font-semibold">TTL</TableHead>
                  <TableHead className="w-[29%] font-semibold">Key</TableHead>
                  <TableHead className="w-[6%] text-right font-semibold">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      Loading sessions…
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      No sessions match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((row) => {
                    const email = typeof row.value?.email === "string" ? row.value.email : "—";
                    const token = hasAppToken(row.value);
                    return (
                      <TableRow key={row.key} className="border-muted-foreground/10 hover:bg-muted/40">
                        <TableCell className="max-w-0 align-middle">
                          <code
                            className="block truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
                            title={row.teamId}
                          >
                            {row.teamId}
                          </code>
                        </TableCell>
                        <TableCell className="max-w-0 align-middle">
                          <code
                            className="block truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
                            title={row.userId}
                          >
                            {row.userId}
                          </code>
                        </TableCell>
                        <TableCell className="max-w-0 align-middle">
                          <span className="block truncate text-sm" title={email}>
                            {email}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-0 align-middle">
                          {token ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}
                        </TableCell>
                        <TableCell className="max-w-0 align-middle whitespace-nowrap">
                          <span className="inline-flex max-w-full items-center gap-1 truncate text-sm text-muted-foreground">
                            <Clock3 className="size-3.5 shrink-0" />
                            <span className="truncate">{expiresText(row.ttlSeconds)}</span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-0 align-middle">
                          <code
                            className="block truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-snug"
                            title={row.key}
                          >
                            {row.key}
                          </code>
                        </TableCell>
                        <TableCell className="max-w-0 text-right align-middle">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => {
                              setSelected(row);
                              setSheetOpen(true);
                            }}
                          >
                            <Eye className="mr-1 size-3.5" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3">
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
            disabled={loading || (page + 1) * PAGE_SIZE >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-4 overflow-y-auto border-l bg-background/95 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b px-6 py-5 text-left">
            <SheetTitle>Session detail</SheetTitle>
            <SheetDescription>
              {selected ? (
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{selected.key}</code>
              ) : (
                "Select a session"
              )}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="space-y-4 px-6 pb-6">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-sm"><span className="text-muted-foreground">Namespace:</span> {selected.namespace}</p>
                <p className="text-sm"><span className="text-muted-foreground">Team:</span> <code>{selected.teamId}</code></p>
                <p className="text-sm"><span className="text-muted-foreground">User:</span> <code>{selected.userId}</code></p>
                <p className="text-sm"><span className="text-muted-foreground">TTL:</span> {expiresText(selected.ttlSeconds)}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Payload JSON</Label>
                <pre className="overflow-auto rounded-xl border bg-muted/20 p-3 text-xs leading-relaxed">
                  {JSON.stringify(selected.value ?? {}, null, 2)}
                </pre>
              </div>
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  Hard reset
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Deletes this Redis key immediately. The user will need to sign in again
                  on next use.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="mt-3 rounded-lg"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmDeleteOpen(true);
                  }}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Remove session
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open);
          if (!open) setDeleteError(null);
        }}
      >
        <DialogContent showCloseButton={!deleteBusy} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this session?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1">
                <p>
                  This will delete the Redis key and cannot be undone. Confirm the key
                  below.
                </p>
                {selected ? (
                  <code className="bg-muted block max-h-24 overflow-auto rounded-md p-2 text-left text-[11px] leading-relaxed break-all">
                    {selected.key}
                  </code>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-destructive text-sm">{deleteError}</p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              disabled={deleteBusy}
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-lg"
              disabled={deleteBusy || !selected}
              onClick={() => void handleDeleteSession()}
            >
              {deleteBusy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
