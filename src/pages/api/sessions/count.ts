import type { NextApiRequest, NextApiResponse } from "next";
import { countSessions } from "@/lib/redis-sessions";

type Ok = {
  success: true;
  data: { total: number };
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
    const total = await countSessions("session:*");
    return res.status(200).json({
      success: true,
      data: { total },
    });
  } catch (error) {
    console.error("sessions count fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sessions count",
    });
  }
}
