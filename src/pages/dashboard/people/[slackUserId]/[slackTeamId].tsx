"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { isAuthenticated, logout } from "@/lib/auth";
import {
  DashboardShell,
  type DashboardNavId,
} from "@/components/dashboard-shell";
import { PeopleUserDetail } from "@/components/people-user-detail";

export default function PeopleDetailPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const slackUserId = router.query.slackUserId;
  const slackTeamId = router.query.slackTeamId;

  const decoded = useMemo(() => {
    const u = Array.isArray(slackUserId) ? slackUserId[0] : slackUserId;
    const t = Array.isArray(slackTeamId) ? slackTeamId[0] : slackTeamId;
    if (typeof u !== "string" || typeof t !== "string" || !u || !t) return null;
    try {
      return {
        slackUserId: decodeURIComponent(u),
        slackTeamId: decodeURIComponent(t),
      };
    } catch {
      return null;
    }
  }, [slackUserId, slackTeamId]);

  useEffect((): void => {
    if (!router.isReady) return;
    if (!isAuthenticated()) {
      void router.replace("/auth/login");
      return;
    }
    setMounted(true);
  }, [router, router.isReady]);

  const handleNavigate = useCallback(
    (id: DashboardNavId) => {
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

  if (!mounted || !router.isReady) return null;

  if (!decoded) {
    return (
      <DashboardShell
        activePage="People"
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      >
        <p className="text-muted-foreground text-sm">Invalid user or team in URL.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activePage="People"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      <PeopleUserDetail
        slackUserId={decoded.slackUserId}
        slackTeamId={decoded.slackTeamId}
      />
    </DashboardShell>
  );
}
