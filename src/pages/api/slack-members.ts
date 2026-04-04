import type { NextApiRequest, NextApiResponse } from "next";
import pool from "@/lib/db";
interface SlackMember {
  [key: string]: string | number | boolean | null;
}

type ResponseData =
  | { success: true; data: SlackMember[] }
  | { success: false; message: string };
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }
  try {
    // :fire: Simple query – no ORDER BY, no column assumptions
    const { rows } = await pool.query(
      `SELECT slack_user_id, slack_team_id, email, requester_id, safserv_active,
              created_at, updated_at, atlas_last_sync
       FROM public.users`
    );
    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Slack members fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch slack members",
    });
  }
}




