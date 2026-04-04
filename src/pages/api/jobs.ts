import type { NextApiRequest, NextApiResponse } from "next";
import {
  listJobsFiltered,
  type JobListFilters,
  type JobSort,
} from "@/lib/operations-queries";

type Ok = {
  success: true;
  data: Awaited<ReturnType<typeof listJobsFiltered>>["rows"];
  total: number;
  limit: number;
  offset: number;
};
type Err = { success: false; message: string };

function parseBool(v: string | string[] | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return undefined;
}

function parseSort(v: string | string[] | undefined): JobSort {
  const s = (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  const allowed: JobSort[] = [
    "created_at_desc",
    "created_at_asc",
    "updated_at_desc",
    "updated_at_asc",
  ];
  return (allowed.includes(s as JobSort) ? s : "created_at_desc") as JobSort;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const q = req.query;
    const limit = Number(q.limit ?? 30);
    const offset = Number(q.offset ?? 0);

    const statusInRaw = q.status_in;
    const statusInStr =
      typeof statusInRaw === "string"
        ? statusInRaw
        : Array.isArray(statusInRaw)
          ? statusInRaw.join(",")
          : "";
    const statusIn = statusInStr
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const sgRaw = q.status_group;
    const statusGroupStr = Array.isArray(sgRaw) ? sgRaw[0] : sgRaw;
    const statusGroup =
      statusGroupStr === "completed" ||
      statusGroupStr === "failed" ||
      statusGroupStr === "queued"
        ? statusGroupStr
        : undefined;

    const filters: JobListFilters = {
      limit: Number.isFinite(limit) ? limit : 30,
      offset: Number.isFinite(offset) ? offset : 0,
      sort: parseSort(q.sort),
      statusIn: statusIn.length ? statusIn : undefined,
      statusGroup: statusIn.length ? undefined : statusGroup,
      jobTypeContains:
        typeof q.job_type === "string" && q.job_type.trim()
          ? q.job_type
          : undefined,
      bullJobIdContains:
        typeof q.bull_job_id === "string" && q.bull_job_id.trim()
          ? q.bull_job_id
          : undefined,
      slackUserId:
        typeof q.slack_user_id === "string" && q.slack_user_id.trim()
          ? q.slack_user_id
          : undefined,
      q: typeof q.q === "string" && q.q.trim() ? q.q : undefined,
      createdFrom:
        typeof q.created_from === "string" && q.created_from.trim()
          ? q.created_from
          : undefined,
      createdTo:
        typeof q.created_to === "string" && q.created_to.trim()
          ? q.created_to
          : undefined,
      updatedFrom:
        typeof q.updated_from === "string" && q.updated_from.trim()
          ? q.updated_from
          : undefined,
      updatedTo:
        typeof q.updated_to === "string" && q.updated_to.trim()
          ? q.updated_to
          : undefined,
      hasError: parseBool(q.has_error),
    };

    const { rows, total } = await listJobsFiltered(filters);
    return res.status(200).json({
      success: true,
      data: rows,
      total,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (error) {
    console.error("jobs fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch jobs",
    });
  }
}
