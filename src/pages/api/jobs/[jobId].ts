import type { NextApiRequest, NextApiResponse } from "next";
import { getJobById } from "@/lib/operations-queries";

type Ok = { success: true; data: NonNullable<Awaited<ReturnType<typeof getJobById>>> };
type Err = { success: false; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const raw = req.query.jobId;
  const jobId = Array.isArray(raw) ? raw[0] : raw;
  if (!jobId || typeof jobId !== "string") {
    return res.status(400).json({ success: false, message: "Missing job id" });
  }

  try {
    const job = await getJobById(decodeURIComponent(jobId));
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    console.error("job detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job",
    });
  }
}
