import type { NextApiRequest, NextApiResponse } from "next";
import { postDigispaceSlackSync } from "@/lib/digispace-sync";

type Ok = { success: true; data: unknown };
type Err = { success: false; message: string; data?: unknown };

function readSlackUserId(req: NextApiRequest): string | null {
  const b = req.body;
  if (typeof b === "string") {
    try {
      const o = JSON.parse(b) as { slack_user_id?: string };
      return typeof o.slack_user_id === "string" ? o.slack_user_id.trim() : null;
    } catch {
      return null;
    }
  }
  if (b && typeof b === "object" && "slack_user_id" in b) {
    const v = (b as { slack_user_id: unknown }).slack_user_id;
    return typeof v === "string" ? v.trim() : null;
  }
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const slackUserId = readSlackUserId(req);
  if (!slackUserId) {
    return res
      .status(400)
      .json({ success: false, message: "Body must include slack_user_id" });
  }

  try {
    const out = await postDigispaceSlackSync("atlas", slackUserId);
    if (!out.configured) {
      return res.status(503).json({
        success: false,
        message:
          "Digispace is not configured. Set DIGISPACE_API_BASE_URL and DIGISPACE_INTERNAL_TOKEN.",
      });
    }
    if (!out.status || out.status < 200 || out.status >= 300) {
      return res.status(502).json({
        success: false,
        message: `Digispace returned HTTP ${out.status}`,
        data: out.json,
      });
    }
    return res.status(200).json({ success: true, data: out.json });
  } catch (e) {
    console.error("digispace sync-atlas:", e);
    return res.status(500).json({
      success: false,
      message: "Failed to reach Digispace",
    });
  }
}
