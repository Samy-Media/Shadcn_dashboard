import type { NextApiRequest, NextApiResponse } from "next";
import { getUserBySlackId } from "@/lib/operations-queries";

type Ok = { success: true; data: NonNullable<Awaited<ReturnType<typeof getUserBySlackId>>> };
type Err = { success: false; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const raw = req.query.slackUserId;
  const slackUserId = Array.isArray(raw) ? raw[0] : raw;
  if (!slackUserId || typeof slackUserId !== "string") {
    return res.status(400).json({ success: false, message: "Missing user id" });
  }

  try {
    const decoded = decodeURIComponent(slackUserId);
    const user = await getUserBySlackId(decoded);
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
