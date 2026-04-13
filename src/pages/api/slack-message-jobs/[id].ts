import type { NextApiRequest, NextApiResponse } from "next";
import { getSlackMessageJobById } from "@/lib/operations-queries";

type Ok = {
  success: true;
  data: NonNullable<Awaited<ReturnType<typeof getSlackMessageJobById>>>;
};
type Err = { success: false; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ success: false, message: "Missing id" });
  }

  try {
    const decoded = decodeURIComponent(id);
    const row = await getSlackMessageJobById(decoded);
    if (!row) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("slack_message_jobs detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch message job",
    });
  }
}
