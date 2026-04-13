export type DigispaceSyncKind = "atlas" | "members";

export async function postDigispaceSlackSync(
  kind: DigispaceSyncKind,
  slackUserId: string
): Promise<
  | { configured: false }
  | { configured: true; status: number; json: unknown; text: string }
> {
  const base = process.env.DIGISPACE_API_BASE_URL?.replace(/\/+$/, "");
  const token = process.env.DIGISPACE_INTERNAL_TOKEN?.trim();
  if (!base || !token) {
    return { configured: false };
  }

  const path =
    kind === "atlas"
      ? process.env.DIGISPACE_SYNC_ATLAS_PATH?.trim() || "/slack/sync-atlas"
      : process.env.DIGISPACE_SYNC_MEMBERS_PATH?.trim() || "/slack/sync-members";
  const pathNorm = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${pathNorm}`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      accept: "*/*",
      "x-internal-token": token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ slack_user_id: slackUserId }).toString(),
  });

  const text = await r.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = { raw: text };
  }
  return { configured: true, status: r.status, json, text };
}
