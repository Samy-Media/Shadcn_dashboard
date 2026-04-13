"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AppWindow,
  Bot,
  Building2,
  Clock,
  Eye,
  Plug2,
  RefreshCw,
  Shield,
  UserCircle2,
} from "lucide-react";

import type { SlackInstallationRow } from "@/lib/operations-queries";
import { InfoTip } from "@/components/info-tip";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { cn } from "@/lib/utils";

function scopeCount(scopes: string | null): number {
  if (!scopes?.trim()) return 0;
  return scopes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;
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

export function InstallationsPanel() {
  const [rows, setRows] = React.useState<SlackInstallationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SlackInstallationRow | null>(
    null
  );

  const load = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/slack-installations");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Failed to load installations");
      }
      setRows(json.data as SlackInstallationRow[]);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeading
        icon={Plug2}
        title="Installations"
        description={
          <>
            <span>
              See every Slack app installation (workspace + app name).
            </span>
            <InfoTip label="About this data">
              <p>
                Each row is from <code>public.slack_installation</code> (unique by
                workspace and <code>app_name</code>): app identity, enterprise, bot,
                OAuth scopes, and install time.
              </p>
            </InfoTip>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-lg"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw
            className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm">
        <div className="text-muted-foreground relative flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs">
          <span>
            <span className="text-foreground font-medium">
              {loading ? "…" : rows.length}
            </span>{" "}
            installation{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="relative px-2 pb-2 pt-2 sm:px-3">
          <ScrollArea className="h-[min(70vh,720px)] w-full rounded-xl border border-muted-foreground/15 bg-card/50">
            <Table className="table-fixed w-full min-w-[860px]">
              <TableHeader>
                <TableRow className="border-muted-foreground/15 hover:bg-transparent">
                  <TableHead className="w-[15%] font-semibold">App name</TableHead>
                  <TableHead className="w-[11%] font-semibold">App ID</TableHead>
                  <TableHead className="w-[13%] font-semibold">
                    Enterprise
                  </TableHead>
                  <TableHead className="w-[11%] font-semibold">
                    Installer
                  </TableHead>
                  <TableHead className="w-[11%] font-semibold">Bot</TableHead>
                  <TableHead className="w-[9%] font-semibold">Scopes</TableHead>
                  <TableHead className="w-[11%] font-semibold">
                    Installed
                  </TableHead>
                  <TableHead className="w-[11%] font-semibold">Updated</TableHead>
                  <TableHead className="w-[8%] pr-6 text-right font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-muted-foreground/10">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <TableCell key={j} className="max-w-0">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-64 text-center align-middle"
                    >
                      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 px-4">
                        <Building2 className="size-10 opacity-40" />
                        <p className="text-sm">No Slack installations found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const nScopes = scopeCount(r.scopes);
                    const rowKey = `${r.slack_team_id}\0${r.app_name ?? ""}`;
                    return (
                      <TableRow
                        key={rowKey}
                        className="border-muted-foreground/10 transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="max-w-0 align-middle">
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            <AppWindow className="text-muted-foreground size-3.5 shrink-0" />
                            <span className="truncate text-sm">
                              {r.app_name?.trim() || "—"}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-0 align-middle">
                          <code
                            className="block truncate rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
                            title={r.app_id ?? undefined}
                          >
                            {r.app_id?.trim() || "—"}
                          </code>
                        </TableCell>
                        <TableCell className="max-w-0 align-middle">
                          {r.enterprise_id || r.enterprise_name ? (
                            <div className="min-w-0 text-sm">
                              <span className="block truncate">
                                {r.enterprise_name?.trim() || "—"}
                              </span>
                              {r.enterprise_id ? (
                                <code
                                  className="text-muted-foreground block truncate font-mono text-[11px]"
                                  title={r.enterprise_id}
                                >
                                  {r.enterprise_id}
                                </code>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-0 align-middle">
                          {r.user_id ? (
                            <span
                              className="flex min-w-0 items-center gap-1 font-mono text-[12px]"
                              title={r.user_id}
                            >
                              <UserCircle2 className="text-muted-foreground size-3 shrink-0" />
                              <span className="truncate">{r.user_id}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-0 align-middle">
                          {r.bot_id ? (
                            <span
                              className="flex min-w-0 items-center gap-1 font-mono text-[12px]"
                              title={r.bot_id}
                            >
                              <Bot className="text-muted-foreground size-3 shrink-0" />
                              <span className="truncate">{r.bot_id}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-0 align-middle">
                          {nScopes > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground inline-flex max-w-full min-w-0 cursor-default items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-left text-xs transition-colors"
                                >
                                  <Shield className="size-3 shrink-0 opacity-70" />
                                  <span className="min-w-0 truncate font-medium text-foreground">
                                    {nScopes} scope{nScopes === 1 ? "" : "s"}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-sm text-xs"
                              >
                                Use <strong>View</strong> for the full OAuth scope
                                list.
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-0 align-middle whitespace-nowrap">
                          {r.installed_at ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-muted-foreground inline-flex max-w-full cursor-default items-center gap-1 truncate text-xs">
                                  <Clock className="size-3 shrink-0" />
                                  <span className="truncate">
                                    {formatDistanceToNow(
                                      new Date(r.installed_at),
                                      { addSuffix: true }
                                    )}
                                  </span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="font-mono text-xs"
                              >
                                {format(new Date(r.installed_at), "PPpp")}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-0 align-middle whitespace-nowrap">
                          {r.updated_at ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-muted-foreground inline-flex max-w-full cursor-default items-center gap-1 truncate text-xs">
                                  <Clock className="size-3 shrink-0" />
                                  <span className="truncate">
                                    {formatDistanceToNow(
                                      new Date(r.updated_at),
                                      { addSuffix: true }
                                    )}
                                  </span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="font-mono text-xs"
                              >
                                {format(new Date(r.updated_at), "PPpp")}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-0 pr-6 text-right align-middle">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => {
                              setSelected(r);
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
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto border-l bg-background/95 p-0 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:max-w-lg"
        >
          <SheetHeader className="space-y-3 border-b bg-muted/30 px-6 py-6 text-left">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/20 shadow-md">
                <Plug2 className="text-primary size-7" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <SheetTitle className="text-xl leading-tight">
                  Installation
                </SheetTitle>
                <SheetDescription className="text-base">
                  {selected?.app_name?.trim() || (
                    <span className="text-muted-foreground">Slack app</span>
                  )}
                  {selected ? (
                    <code className="mt-1 block truncate rounded-md bg-muted px-2 py-0.5 font-mono text-sm text-foreground">
                      {selected.app_id?.trim() || "—"}
                    </code>
                  ) : null}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 px-6 py-6">
            {selected ? (
              <>
                <div className="space-y-4">
                  <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Slack app
                  </h3>
                  <div className="space-y-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                    <DetailRow
                      label="App name"
                      value={selected.app_name?.trim() || "—"}
                    />
                    <Separator />
                    <DetailRow
                      label="App ID"
                      value={selected.app_id?.trim() || "—"}
                      mono
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Workspace
                  </h3>
                  <div className="space-y-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                    <DetailRow
                      label="Team name"
                      value={selected.team_name?.trim() || "—"}
                    />
                    <Separator />
                    <DetailRow
                      label="Team ID"
                      value={selected.slack_team_id}
                      mono
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Enterprise
                  </h3>
                  <div className="space-y-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                    <DetailRow
                      label="Name"
                      value={selected.enterprise_name?.trim() || "—"}
                    />
                    <Separator />
                    <DetailRow
                      label="Enterprise ID"
                      value={selected.enterprise_id}
                      mono
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Bot & installer
                  </h3>
                  <div className="space-y-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                    <DetailRow
                      label="Installer user"
                      value={selected.user_id}
                      mono
                    />
                    <Separator />
                    <DetailRow label="Bot ID" value={selected.bot_id} mono />
                    <Separator />
                    <DetailRow
                      label="App base URL"
                      value={selected.app_base_url?.trim() || "—"}
                      mono
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                    <Shield className="size-3.5" />
                    OAuth scopes
                  </h3>
                  <div className="rounded-xl border bg-card/80 p-4 shadow-sm">
                    {selected.scopes?.trim() ? (
                      <pre className="text-muted-foreground max-h-[min(40vh,280px)] overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                        {selected.scopes}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground text-sm">—</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Timestamps
                  </h3>
                  <div className="space-y-3 rounded-xl border bg-card/80 p-4 shadow-sm">
                    <DetailRow
                      label="Installed"
                      value={
                        selected.installed_at
                          ? format(new Date(selected.installed_at), "PPpp")
                          : "—"
                      }
                    />
                    <Separator />
                    <DetailRow
                      label="Updated"
                      value={
                        selected.updated_at
                          ? format(new Date(selected.updated_at), "PPpp")
                          : "—"
                      }
                    />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
