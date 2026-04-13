export type HealthCheckEntry = {
  displayName: string;
  /** Slack app id — shown under the title in a muted capsule when set */
  appIdLabel?: string | null;
  url: string;
  httpOk: boolean;
  httpStatus: number;
  latencyMs: number;
  error: string | null;
  payload: Record<string, unknown> | null;
};
