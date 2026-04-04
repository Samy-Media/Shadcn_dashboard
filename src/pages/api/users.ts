import type { NextApiRequest, NextApiResponse } from "next";
import {
  listUsersFiltered,
  parseUserListSort,
  type UserListFilters,
} from "@/lib/operations-queries";

type Ok = {
  success: true;
  data: Awaited<ReturnType<typeof listUsersFiltered>>["rows"];
  total: number;
  limit: number;
  offset: number;
};
type Err = { success: false; message: string };

function parseTri(v: string | string[] | undefined): boolean | undefined {
  const s = (Array.isArray(v) ? v[0] : v)?.trim().toLowerCase() ?? "";
  if (!s || s === "any") return undefined;
  if (s === "yes" || s === "true" || s === "1") return true;
  if (s === "no" || s === "false" || s === "0") return false;
  return undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    const q = req.query;
    const limit = Number(q.limit ?? 30);
    const offset = Number(q.offset ?? 0);

    const hasEmailRaw = q.has_email;
    const hasEmailStr = Array.isArray(hasEmailRaw) ? hasEmailRaw[0] : hasEmailRaw;
    const safservRaw = q.safserv_active;
    const safservStr = Array.isArray(safservRaw) ? safservRaw[0] : safservRaw;

    let hasEmail: boolean | undefined;
    if (typeof hasEmailStr === "string" && hasEmailStr.trim()) {
      hasEmail = parseTri(hasEmailStr);
    }

    let safservActive: boolean | undefined;
    if (typeof safservStr === "string" && safservStr.trim()) {
      safservActive = parseTri(safservStr);
    }

    const sortRaw = q.sort;
    const sortStr = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;
    const sort = parseUserListSort(
      typeof sortStr === "string" ? sortStr : undefined
    );

    const filters: UserListFilters = {
      limit: Number.isFinite(limit) ? limit : 30,
      offset: Number.isFinite(offset) ? offset : 0,
      q: typeof q.q === "string" && q.q.trim() ? q.q : undefined,
      slackUserId:
        typeof q.slack_user_id === "string" && q.slack_user_id.trim()
          ? q.slack_user_id
          : undefined,
      requesterIdContains:
        typeof q.requester_id === "string" && q.requester_id.trim()
          ? q.requester_id
          : undefined,
      hasEmail,
      safservActive,
      sort,
    };

    const { rows, total } = await listUsersFiltered(filters);
    return res.status(200).json({
      success: true,
      data: rows,
      total,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (error) {
    console.error("users fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
}
