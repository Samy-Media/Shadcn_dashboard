"use client";

import * as React from "react";
import {
  GalleryVerticalEnd,
  Layers,
  LogOut,
  PieChart,
  KeyRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/ModeToggle";

export type DashboardNavId = "Dashboard" | "People" | "Jobs" | "Sessions";

const NAV: {
  id: DashboardNavId;
  label: string;
  icon: React.ElementType<{ className?: string }>;
}[] = [
  { id: "Dashboard", label: "Overview", icon: PieChart },
  { id: "People", label: "People", icon: Users },
  { id: "Jobs", label: "Jobs", icon: Layers },
  { id: "Sessions", label: "Sessions", icon: KeyRound },
];

type DashboardShellProps = {
  activePage: DashboardNavId;
  onNavigate: (id: DashboardNavId) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

export function DashboardShell({
  activePage,
  onNavigate,
  onLogout,
  children,
}: DashboardShellProps) {
  return (
    <div className="themed-title relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(var(--primary)/0.14),transparent_55%)]"
          aria-hidden
        />
        <div
          className="absolute right-[-10%] top-[10%] h-[min(55vw,480px)] w-[min(55vw,480px)] rounded-full bg-violet-500/[0.07] blur-3xl dark:bg-violet-400/[0.09]"
          aria-hidden
        />
        <div
          className="absolute bottom-[-5%] left-[-5%] h-[min(50vw,420px)] w-[min(50vw,420px)] rounded-full bg-cyan-500/[0.06] blur-3xl dark:bg-cyan-400/[0.08]"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
          aria-hidden
        />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner ring-1 ring-primary/10">
              <GalleryVerticalEnd className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight">
                Safexpress
              </p>
              <p className="text-muted-foreground truncate text-xs font-medium">
                Slack Central · Operations
              </p>
            </div>
          </div>

          <nav
            className="flex w-full justify-center sm:w-auto sm:flex-1 sm:justify-center"
            aria-label="Main"
          >
            <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1.5 shadow-sm backdrop-blur-md dark:bg-muted/25 sm:flex-nowrap">
              {NAV.map(({ id, label, icon: Icon }) => {
                const active = activePage === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onNavigate(id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200",
                      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                      active
                        ? "bg-background text-foreground shadow-md ring-1 ring-border/60 dark:bg-background/90"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        active ? "text-primary" : "opacity-70"
                      )}
                    />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex w-full items-center justify-end sm:w-auto sm:shrink-0">
            <div
              className={cn(
                "flex items-center gap-0.5 rounded-2xl border border-border/60 bg-muted/40 p-1 shadow-sm",
                "backdrop-blur-md dark:bg-muted/25"
              )}
            >
              <ModeToggle />
              <Separator
                orientation="vertical"
                className="mx-0.5 h-6 bg-border/70"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className={cn(
                  "h-9 gap-2 rounded-xl px-3 font-medium text-muted-foreground",
                  "hover:bg-background/90 hover:text-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring/60"
                )}
              >
                <LogOut className="size-4 opacity-80" aria-hidden />
                Log out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[1400px] flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
