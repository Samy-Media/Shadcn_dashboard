import type { NextApiRequest, NextApiResponse } from "next";
import { deleteSessionByKey } from "@/lib/redis-sessions";

type Ok = { success: true; deleted: boolean };
type Err = { success: false; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const raw = req.body;
  const key =
    raw &&
    typeof raw === "object" &&
    "key" in raw &&
    typeof (raw as { key: unknown }).key === "string"
      ? (raw as { key: string }).key.trim()
      : "";

  if (!key) {
    return res.status(400).json({ success: false, message: "Missing key" });
  }

  try {
    const deleted = await deleteSessionByKey(key);
    return res.status(200).json({ success: true, deleted });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to delete session";
    if (msg === "Invalid session key") {
      return res.status(400).json({ success: false, message: msg });
    }
    console.error("session delete error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete session",
    });
  }
}
