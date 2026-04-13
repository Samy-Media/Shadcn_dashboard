import type { NextApiRequest, NextApiResponse } from "next";
import {
  getUserByCompositeKey,
  getUserBySlackId,
  updateUserByCompositeKey,
  type UserEditableFields,
  type UserRow,
} from "@/lib/operations-queries";

type OkGet = { success: true; data: UserRow };
type OkPatch = { success: true; data: UserRow };
type Err = { success: false; message: string };

function parseBigintField(
  raw: unknown,
  label: string
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string" && typeof raw !== "number") {
    return { ok: false, message: `${label} must be a string or number` };
  }
  const s = String(raw).trim();
  if (s === "") return { ok: true, value: null };
  if (!/^\d+$/.test(s)) {
    return { ok: false, message: `${label} must be digits or empty` };
  }
  return { ok: true, value: s };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OkGet | OkPatch | Err>
) {
  const raw = req.query.slackUserId;
  const slackUserId = Array.isArray(raw) ? raw[0] : raw;
  if (!slackUserId || typeof slackUserId !== "string") {
    return res.status(400).json({ success: false, message: "Missing user id" });
  }

  const decoded = decodeURIComponent(slackUserId);

  if (req.method === "GET") {
    try {
      const teamQ = req.query.slack_team_id;
      const teamRaw = Array.isArray(teamQ) ? teamQ[0] : teamQ;
      const team =
        typeof teamRaw === "string" && teamRaw.trim()
          ? decodeURIComponent(teamRaw.trim())
          : null;

      const user = team
        ? await getUserByCompositeKey(decoded, team)
        : await getUserBySlackId(decoded);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      console.error("user detail fetch error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch user",
      });
    }
  }

  if (req.method === "PATCH") {
    try {
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ success: false, message: "Invalid JSON body" });
      }
      const teamId = body.slack_team_id;
      if (typeof teamId !== "string" || !teamId.trim()) {
        return res.status(400).json({
          success: false,
          message: "Body must include slack_team_id",
        });
      }
      const slack_team_id = teamId.trim();

      const required = [
        "email",
        "requester_id",
        "is_agent",
        "agent_requester_id",
      ] as const;
      for (const k of required) {
        if (!(k in body)) {
          return res.status(400).json({
            success: false,
            message: `Body must include ${k}`,
          });
        }
      }

      const email =
        body.email === null ? null : String(body.email).trim() || null;
      if (email !== null && email.length > 320) {
        return res.status(400).json({
          success: false,
          message: "Email is too long",
        });
      }

      const reqId = parseBigintField(body.requester_id, "requester_id");
      if (!reqId.ok) {
        return res.status(400).json({ success: false, message: reqId.message });
      }
      const agentReqId = parseBigintField(
        body.agent_requester_id,
        "agent_requester_id"
      );
      if (!agentReqId.ok) {
        return res.status(400).json({
          success: false,
          message: agentReqId.message,
        });
      }

      if (typeof body.is_agent !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "is_agent must be a boolean",
        });
      }
      const is_agent = body.is_agent;

      const patch: UserEditableFields = {
        email,
        requester_id: reqId.value,
        is_agent,
        agent_requester_id: agentReqId.value,
      };

      const updated = await updateUserByCompositeKey(
        decoded,
        slack_team_id,
        patch
      );
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "User not found or team id mismatch",
        });
      }
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("user patch error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update user",
      });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
