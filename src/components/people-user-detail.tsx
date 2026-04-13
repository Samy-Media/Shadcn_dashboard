"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { format } from "date-fns";
import { ArrowLeft, Bot, CloudUpload, Loader2, Save, Users } from "lucide-react";

import type { UserRecord } from "@/components/people-table";
import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
type FormState = {
  email: string;
  requester_id: string;
  agent_requester_id: string;
  is_agent: boolean;
};

function userToForm(u: UserRecord): FormState {
  return {
    email: u.email ?? "",
    requester_id: u.requester_id ?? "",
    agent_requester_id: u.agent_requester_id ?? "",
    is_agent: u.is_agent === true,
  };
}

export function PeopleUserDetail({
  slackUserId,
  slackTeamId,
}: {
  slackUserId: string;
  slackTeamId: string;
}) {
  const router = useRouter();
  const [user, setUser] = React.useState<UserRecord | null>(null);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [savedOk, setSavedOk] = React.useState(false);
  const [syncAtlasBusy, setSyncAtlasBusy] = React.useState(false);
  const [syncMembersBusy, setSyncMembersBusy] = React.useState(false);
  const [syncNotice, setSyncNotice] = React.useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/users/${encodeURIComponent(slackUserId)}?slack_team_id=${encodeURIComponent(slackTeamId)}`
        );
        const json = (await res.json()) as {
          success?: boolean;
          data?: UserRecord;
          message?: string;
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.message ?? "Could not load user");
        }
        if (!cancelled) {
          setUser(json.data);
          setForm(userToForm(json.data));
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Error");
          setUser(null);
          setForm(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slackUserId, slackTeamId]);

  const dirty =
    user &&
    form &&
    (form.email !== (user.email ?? "") ||
      form.requester_id !== (user.requester_id ?? "") ||
      form.agent_requester_id !== (user.agent_requester_id ?? "") ||
      form.is_agent !== (user.is_agent === true));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(slackUserId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slack_team_id: slackTeamId,
          email: form.email.trim() === "" ? null : form.email.trim(),
          requester_id: form.requester_id.trim() === "" ? null : form.requester_id.trim(),
          is_agent: form.is_agent,
          agent_requester_id:
            form.agent_requester_id.trim() === "" ? null : form.agent_requester_id.trim(),
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: UserRecord;
        message?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Save failed");
      }
      setUser(json.data);
      setForm(userToForm(json.data));
      setSavedOk(true);
      window.setTimeout(() => setSavedOk(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const runDigispaceSync = async (
    path: "/api/digispace/sync-atlas" | "/api/digispace/sync-members",
    setBusy: (v: boolean) => void
  ) => {
    setSyncNotice(null);
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slack_user_id: slackUserId }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: unknown;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }
      const summary =
        typeof json.data === "object" && json.data !== null
          ? JSON.stringify(json.data)
          : String(json.data ?? "OK");
      setSyncNotice({ kind: "ok", text: summary });
    } catch (e) {
      setSyncNotice({
        kind: "err",
        text: e instanceof Error ? e.message : "Sync failed",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading user…
      </div>
    );
  }

  if (loadError || !user || !form) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm">{loadError ?? "Not found"}</p>
        <Button type="button" variant="outline" onClick={() => void router.push("/dashboard?tab=people")}>
          <ArrowLeft className="mr-2 size-4" />
          Back to People
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-2" asChild>
          <Link href="/dashboard?tab=people">
            <ArrowLeft className="size-4" />
            People
          </Link>
        </Button>
        <Button
          type="button"
          disabled={saving || !dirty}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Save changes
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Person</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Edit directory fields for this Slack user in this workspace.
        </p>
      </div>

      {saveError ? (
        <p className="text-destructive text-sm" role="alert">
          {saveError}
        </p>
      ) : null}
      {savedOk ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
          Saved.
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border bg-card/60 p-6 shadow-sm">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          Identity
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack_user_id">Slack user ID</Label>
            <Input
              id="slack_user_id"
              readOnly
              className="font-mono text-sm"
              value={user.slack_user_id}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slack_team_id">Slack team ID</Label>
            <Input
              id="slack_team_id"
              readOnly
              className="font-mono text-sm"
              value={user.slack_team_id}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, email: e.target.value } : f))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requester_id">Requester ID</Label>
            <Input
              id="requester_id"
              className="font-mono text-sm"
              inputMode="numeric"
              placeholder="Digits only"
              value={form.requester_id}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, requester_id: e.target.value } : f))
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card/60 p-6 shadow-sm">
        <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Bot className="size-3.5" />
          Agent
        </h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="agent_mode">Agent mode</Label>
            <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
              <span>Whether agent automation is on for this person.</span>
              <InfoTip label="Database column">
                <p>
                  Stored as <code>isAgent</code> on <code>public.users</code>.
                </p>
              </InfoTip>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="agent_mode"
              checked={form.is_agent}
              onCheckedChange={(c) =>
                setForm((f) => (f ? { ...f, is_agent: c === true } : f))
              }
            />
            <span className="text-sm font-medium">{form.is_agent ? "On" : "Off"}</span>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="agent_requester_id">agent_requester_id</Label>
          <Input
            id="agent_requester_id"
            className="font-mono text-sm"
            inputMode="numeric"
            placeholder="Digits only"
            value={form.agent_requester_id}
            onChange={(e) =>
              setForm((f) =>
                f ? { ...f, agent_requester_id: e.target.value } : f
              )
            }
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card/60 p-6 shadow-sm">
        <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <CloudUpload className="size-3.5" />
          Digispace sync
        </h2>
        <p className="text-muted-foreground flex flex-wrap items-start gap-1.5 text-xs">
          <span>Queue Atlas or members sync for this Slack user on Digispace.</span>
          <InfoTip label="Configuration">
            <p>
              The dashboard calls Digispace using{" "}
              <code>DIGISPACE_API_BASE_URL</code>,{" "}
              <code>DIGISPACE_INTERNAL_TOKEN</code> (<code>x-internal-token</code>
              ), and optional <code>DIGISPACE_SYNC_ATLAS_PATH</code> /{" "}
              <code>DIGISPACE_SYNC_MEMBERS_PATH</code> (defaults{" "}
              <code>/slack/sync-atlas</code> and <code>/slack/sync-members</code>).
            </p>
          </InfoTip>
        </p>
        {syncNotice ? (
          <p
            className={
              syncNotice.kind === "ok"
                ? "text-sm text-emerald-600 dark:text-emerald-400"
                : "text-destructive text-sm"
            }
            role="status"
          >
            {syncNotice.text}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={syncAtlasBusy || syncMembersBusy}
            onClick={() =>
              void runDigispaceSync("/api/digispace/sync-atlas", setSyncAtlasBusy)
            }
          >
            {syncAtlasBusy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CloudUpload className="mr-2 size-4" />
            )}
            Sync Atlas
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={syncAtlasBusy || syncMembersBusy}
            onClick={() =>
              void runDigispaceSync(
                "/api/digispace/sync-members",
                setSyncMembersBusy
              )
            }
          >
            {syncMembersBusy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Users className="mr-2 size-4" />
            )}
            Sync members
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
        <p className="flex flex-wrap items-start gap-1.5">
          <span className="font-medium text-foreground">Extra context.</span>
          <span>You cannot edit these fields on this screen.</span>
          <InfoTip label="What these are">
            <p>
              SafeServ and Digispace flags, plus created, updated, and Atlas sync
              timestamps from <code>public.users</code>.
            </p>
          </InfoTip>
        </p>
        <div className="grid gap-2 font-mono sm:grid-cols-2">
          <span>safeserv_active: {String(user.safeserv_active)}</span>
          <span>digispace_active: {String(user.digispace_active)}</span>
          <span>
            created_at:{" "}
            {user.created_at ? format(new Date(user.created_at), "PPpp") : "—"}
          </span>
          <span>
            updated_at:{" "}
            {user.updated_at ? format(new Date(user.updated_at), "PPpp") : "—"}
          </span>
          <span className="sm:col-span-2">
            atlas_last_sync:{" "}
            {user.atlas_last_sync
              ? format(new Date(user.atlas_last_sync), "PPpp")
              : "—"}
          </span>
        </div>
      </section>
    </div>
  );
}
