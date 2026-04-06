import type { NextApiRequest, NextApiResponse } from "next";
import { getDashboardStats } from "@/lib/operations-queries";
import { countSessions } from "@/lib/redis-sessions";

type Ok = { success: true; data: Awaited<ReturnType<typeof getDashboardStats>> };
type Err = { success: false; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    const data = await getDashboardStats();

    try {
      data.activeSessions = await countSessions("session:*");
    } catch {
      // Keep dashboard stats available even if Redis is unavailable.
      data.activeSessions = 0;
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("stats fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
    });
  }
}
