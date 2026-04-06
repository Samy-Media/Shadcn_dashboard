"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { isAuthenticated, logout } from "@/lib/auth";
import {
  DashboardShell,
  type DashboardNavId,
} from "@/components/dashboard-shell";
import { OperationsDashboard } from "@/components/operations-dashboard";
import { ProductTable } from "@/components/people-table";
import { JobsPanel } from "@/components/jobs-panel";

function parseTab(
  tab: string | string[] | undefined
): DashboardNavId {
  const v = Array.isArray(tab) ? tab[0] : tab;
  if (v === "people") return "People";
  if (v === "jobs") return "Jobs";
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
        const tab = id === "People" ? "people" : "jobs";
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
      ) : (
        <JobsPanel />
      )}
    </DashboardShell>
  );
}
