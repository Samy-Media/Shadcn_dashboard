"use client";

import * as React from "react";
import {
  Activity,
  GalleryVerticalEnd,
  Globe2,
  KeyRound,
  Layers,
  LogOut,
  MessageSquare,
  PieChart,
  Plug2,
  Users,
} from "lucide-react";

import { ModeToggle } from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type DashboardNavId =
  | "Dashboard"
  | "People"
  | "Jobs"
  | "Messages"
  | "Atlas"
  | "Sessions"
  | "Installations"
  | "Health";

const NAV: {
  id: DashboardNavId;
  label: string;
  description: string;
  icon: React.ElementType<{ className?: string }>;
}[] = [
  { id: "Dashboard", label: "Overview", description: "Operations summary", icon: PieChart },
  { id: "People", label: "People", description: "Directory and members", icon: Users },
  { id: "Jobs", label: "Jobs", description: "Queues and status", icon: Layers },
  { id: "Messages", label: "Messages", description: "Slack message flows", icon: MessageSquare },
  { id: "Atlas", label: "Atlas", description: "Sync activity", icon: Globe2 },
  { id: "Sessions", label: "Sessions", description: "Access and tokens", icon: KeyRound },
  { id: "Installations", label: "Installations", description: "Workspace installs", icon: Plug2 },
  { id: "Health", label: "Health", description: "System checks", icon: Activity },
];

type DashboardShellProps = {
  activePage: DashboardNavId;
  onNavigate: (id: DashboardNavId) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

function DashboardSidebarNav({
  activePage,
  onNavigate,
}: Pick<DashboardShellProps, "activePage" | "onNavigate">) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu className="gap-1 px-2">
      {NAV.map(({ id, label, description, icon: Icon }) => (
        <SidebarMenuItem key={id}>
          <SidebarMenuButton
            tooltip={label}
            isActive={activePage === id}
            className={cn(
              "h-auto min-h-12 rounded-xl px-3 py-2.5",
              "data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground",
              "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!size-12 group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:aspect-square group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:p-0"
            )}
            onClick={() => {
              onNavigate(id);
              if (isMobile) setOpenMobile(false);
            }}
          >
            <div
              className={cn(
                "flex size-8 items-center justify-center transition-colors",
                activePage === id
                  ? "text-sidebar-primary-foreground"
                  : "text-sidebar-foreground"
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium">{label}</span>
              <span
                className={cn(
                  "truncate text-xs",
                  activePage === id
                    ? "text-sidebar-primary-foreground/75"
                    : "text-sidebar-foreground/55"
                )}
              >
                {description}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function DashboardSidebarActions({
  onLogout,
}: Pick<DashboardShellProps, "onLogout">) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarFooter className="gap-2 px-2 pb-3">
      <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/55 px-3 py-3 group-data-[collapsible=icon]:hidden">
        <p className="text-sm font-semibold text-sidebar-foreground">Shade CN</p>
        <p className="mt-1 text-xs leading-5 text-sidebar-foreground/65">
          Safexpress operations, health, jobs, sessions, and installs.
        </p>
      </div>
      <ModeToggle className="w-full justify-center rounded-xl border border-sidebar-border/80 bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:rounded-full" />
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          onLogout();
          if (isMobile) setOpenMobile(false);
        }}
        className={cn(
          "justify-start rounded-xl border-sidebar-border/80 bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
          "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0"
        )}
      >
        <LogOut className="size-4" aria-hidden />
        <span className="group-data-[collapsible=icon]:hidden">Log out</span>
      </Button>
    </SidebarFooter>
  );
}

export function DashboardShell({
  activePage,
  onNavigate,
  onLogout,
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_110%_80%_at_20%_0%,hsl(var(--primary)/0.12),transparent_42%),radial-gradient(ellipse_90%_70%_at_100%_100%,hsl(var(--primary)/0.08),transparent_38%)] dark:bg-[radial-gradient(ellipse_110%_80%_at_20%_0%,hsl(var(--primary)/0.14),transparent_42%),radial-gradient(ellipse_90%_70%_at_100%_100%,hsl(var(--primary)/0.10),transparent_38%)]"
          aria-hidden
        />
      </div>
      <SidebarProvider defaultOpen={false}>
        <Sidebar
          variant="floating"
          collapsible="icon"
          className="border-r-0 bg-transparent group-data-[collapsible=icon]:w-[5.25rem]"
        >
          <SidebarHeader className="px-2 py-3 group-data-[collapsible=icon]:px-4 group-data-[collapsible=icon]:py-4">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onNavigate("Dashboard")}
                className={cn(
                  "h-auto min-h-14 flex-1 justify-start rounded-2xl px-3 py-3",
                  "group-data-[collapsible=icon]:size-14 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:px-0"
                )}
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary/15 text-sidebar-primary ring-1 ring-sidebar-primary/20 group-data-[collapsible=icon]:size-11">
                  <GalleryVerticalEnd className="size-5 group-data-[collapsible=icon]:size-[22px]" />
                </div>
                <div className="ml-2 text-left group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-semibold leading-none text-sidebar-foreground">
                    Shade CN
                  </p>
                  <p className="mt-1 text-xs leading-none text-sidebar-foreground/65">
                    Safexpress control center
                  </p>
                </div>
              </Button>
            </div>
          </SidebarHeader>

          <SidebarSeparator className="mx-2 group-data-[collapsible=icon]:mx-4 group-data-[collapsible=icon]:hidden" />
          <SidebarContent className="py-2">
            <DashboardSidebarNav
              activePage={activePage}
              onNavigate={onNavigate}
            />
          </SidebarContent>
          <SidebarSeparator className="mx-2 group-data-[collapsible=icon]:mx-4 group-data-[collapsible=icon]:hidden" />
          <DashboardSidebarActions onLogout={onLogout} />
        </Sidebar>

        <SidebarInset className="min-w-0 bg-transparent">
          <main className="mx-auto w-full min-w-0 max-w-[1600px] px-4 pb-10 pt-5 sm:px-6 sm:pt-6 md:pl-7 lg:px-8 lg:pt-7">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
