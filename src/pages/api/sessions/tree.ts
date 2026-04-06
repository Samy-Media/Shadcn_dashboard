import type { NextApiRequest, NextApiResponse } from "next";
import {
  countSessions,
  listSessionsLimited,
  toSessionTree,
} from "@/lib/redis-sessions";

type Ok = {
  success: true;
  data: {
    total: number;
    returned: number;
    limit: number;
    sessions: Record<string, Record<string, Record<string, {
      key: string;
      ttlSeconds: number | null;
      value: Record<string, unknown> | null;
    }>>>;
  };
};
type Err = { success: false; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limit = Math.max(1, Math.min(1000, Number(limitRaw ?? 500) || 500));
    const [list, total] = await Promise.all([
      listSessionsLimited(limit, "session:*"),
      countSessions("session:*"),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        returned: list.length,
        limit,
        sessions: toSessionTree(list) as Ok["data"]["sessions"],
      },
    });
  } catch (error) {
    console.error("sessions tree fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sessions tree",
    });
  }
}
