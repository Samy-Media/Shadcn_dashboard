import type { NextApiRequest, NextApiResponse } from "next";
import { listSlackInstallations } from "@/lib/operations-queries";

type Ok = {
  success: true;
  data: Awaited<ReturnType<typeof listSlackInstallations>>;
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
    const data = await listSlackInstallations();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("slack installations fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Slack installations",
    });
  }
}
