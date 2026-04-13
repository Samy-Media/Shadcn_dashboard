"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { isAuthenticated, logout } from "@/lib/auth";
import {
  DashboardShell,
  type DashboardNavId,
} from "@/components/dashboard-shell";
import { HealthPanel } from "@/components/health-panel";
import { InstallationsPanel } from "@/components/installations-panel";
import { AtlasJobsPanel } from "@/components/atlas-jobs-panel";
import { JobsPanel } from "@/components/jobs-panel";
import { MessagesPanel } from "@/components/messages-panel";
import { OperationsDashboard } from "@/components/operations-dashboard";
import { ProductTable } from "@/components/people-table";
import { SessionsPanel } from "@/components/sessions-panel";

function parseTab(
  tab: string | string[] | undefined
): DashboardNavId {
  const v = Array.isArray(tab) ? tab[0] : tab;
  if (v === "people") return "People";
  if (v === "jobs") return "Jobs";
  if (v === "messages") return "Messages";
  if (v === "atlas") return "Atlas";
  if (v === "sessions") return "Sessions";
  if (v === "installations") return "Installations";
  if (v === "health") return "Health";
  return "Dashboard";
}

export default function Page() {
  const router = useRouter();
  const [activePage, setActivePage] = useState<DashboardNavId>("Dashboard");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect((): void => {
    if (!router.isReady) return;
    if (!isAuthenticated()) {
      void router.replace("/auth/login");
      return;
    }
    setActivePage(parseTab(router.query.tab));
    setMounted(true);
  }, [router, router.isReady, router.query.tab]);

  const handleNavigate = useCallback(
    (id: DashboardNavId) => {
      setActivePage(id);
      if (id === "Dashboard") {
        void router.replace("/dashboard", undefined, { shallow: true });
      } else {
        const tab =
          id === "People"
            ? "people"
            : id === "Jobs"
              ? "jobs"
              : id === "Messages"
                ? "messages"
                : id === "Atlas"
                  ? "atlas"
                  : id === "Sessions"
                    ? "sessions"
                    : id === "Installations"
                      ? "installations"
                      : "health";
        void router.replace(`/dashboard?tab=${tab}`, undefined, { shallow: true });
      }
    },
    [router]
  );

  const handleLogout = (): void => {
    logout();
    void router.push("/auth/login");
  };

  if (!mounted) return null;

  return (
    <DashboardShell
      activePage={activePage}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {activePage === "Dashboard" ? (
        <OperationsDashboard />
      ) : activePage === "People" ? (
        <ProductTable />
      ) : activePage === "Jobs" ? (
        <JobsPanel />
      ) : activePage === "Messages" ? (
        <MessagesPanel />
      ) : activePage === "Atlas" ? (
        <AtlasJobsPanel />
      ) : activePage === "Sessions" ? (
        <SessionsPanel />
      ) : activePage === "Installations" ? (
        <InstallationsPanel />
      ) : (
        <HealthPanel />
      )}
    </DashboardShell>
  );
}
