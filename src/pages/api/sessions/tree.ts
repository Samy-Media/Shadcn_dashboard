import type { NextApiRequest, NextApiResponse } from "next";

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
    const base = process.env.REDIS_API_BASE_URL?.trim() || "http://localhost:3030";
    const response = await fetch(`${base}/sessions/tree?limit=${limit}`);
    const json = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: json?.error ?? "Failed to fetch sessions tree",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        total: Number(json?.total ?? 0),
        returned: Number(json?.returned ?? 0),
        limit: Number(json?.limit ?? limit),
        sessions: (json?.sessions ?? {}) as Ok["data"]["sessions"],
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
