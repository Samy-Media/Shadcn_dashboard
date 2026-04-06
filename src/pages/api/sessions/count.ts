import type { NextApiRequest, NextApiResponse } from "next";

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
    const base = process.env.REDIS_API_BASE_URL?.trim() || "http://localhost:3030";
    const response = await fetch(`${base}/sessions/count`);
    const json = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: json?.error ?? "Failed to fetch sessions count",
      });
    }

    return res.status(200).json({
      success: true,
      data: { total: Number(json?.total ?? 0) },
    });
  } catch (error) {
    console.error("sessions count fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sessions count",
    });
  }
}
