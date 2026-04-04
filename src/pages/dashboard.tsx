"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, logout } from "@/lib/auth";
import {
  DashboardShell,
  type DashboardNavId,
} from "@/components/dashboard-shell";
import { OperationsDashboard } from "@/components/operations-dashboard";
import { ProductTable } from "@/components/people-table";
import { JobsPanel } from "@/components/jobs-panel";

export default function Page() {
  const router = useRouter();
  const [activePage, setActivePage] = useState<DashboardNavId>("Dashboard");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect((): void => {
    if (!isAuthenticated()) {
      router.replace("/auth/login");
    } else {
      setMounted(true);
    }
  }, [router]);

  const handleLogout = (): void => {
    logout();
    router.push("/auth/login");
  };

  if (!mounted) return null;

  return (
    <DashboardShell
      activePage={activePage}
      onNavigate={setActivePage}
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
