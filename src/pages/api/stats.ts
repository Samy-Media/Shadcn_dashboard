import type { NextApiRequest, NextApiResponse } from "next";
import { getDashboardStats } from "@/lib/operations-queries";

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

    const redisBase = process.env.REDIS_API_BASE_URL?.trim() || "http://localhost:3030";
    try {
      const sessionsRes = await fetch(`${redisBase}/sessions/count`);
      if (sessionsRes.ok) {
        const json = await sessionsRes.json();
        data.activeSessions = Number(json?.total ?? 0);
      } else {
        data.activeSessions = 0;
      }
    } catch {
      // Keep dashboard stats available even if Redis API is down.
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
