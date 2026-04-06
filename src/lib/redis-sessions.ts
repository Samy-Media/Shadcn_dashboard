type SessionValue = Record<string, unknown> | null;

export type SessionEntry = {
  key: string;
  ttlSeconds: number | null;
  value: SessionValue;
};

export type SessionTree = Record<
  string,
  Record<string, Record<string, SessionEntry>>
>;

type RedisClient = {
  scan: (...args: unknown[]) => Promise<[string, string[]]>;
  pipeline: () => {
    get: (key: string) => unknown;
    ttl: (key: string) => unknown;
    exec: () => Promise<Array<[unknown, unknown]>>;
  };
  on: (event: string, cb: (err: Error) => void) => void;
};

let redisClient: RedisClient | null = null;

function redisClientOptionsFromUrl() {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) {
    throw new Error("REDIS_URL environment variable is not defined");
  }

  const redisUrl = new URL(raw);
  const isTls = redisUrl.protocol === "rediss:";

  return {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port, 10) || 6379,
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    ...(isTls ? { tls: {} } : {}),
    connectTimeout: 10_000,
    commandTimeout: 5_000,
    keepAlive: 30_000,
    retryStrategy(times: number) {
      return Math.min(times * 150, 3_000);
    },
  };
}

export function getRedisClient(): RedisClient {
  if (redisClient) return redisClient;

  // Avoid static import to keep startup resilient until REDIS_URL is needed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis = require("ioredis");
  const client = new Redis(redisClientOptionsFromUrl()) as RedisClient;
  client.on("error", (err: Error) => {
    console.error("Redis error:", err.message);
  });
  redisClient = client;
  return client;
}

function parseKey(key: string) {
  const parts = String(key).split(":");
  return {
    namespace: parts[0] || "session",
    teamId: parts[1] || "unknown_team",
    userId: parts.slice(2).join(":") || "unknown_user",
  };
}

function parseValue(raw: unknown): SessionValue {
  if (raw == null) return null;
  if (Buffer.isBuffer(raw)) {
    raw = raw.toString("utf8");
  }
  if (typeof raw !== "string") {
    return typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : { value: raw };
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { value: raw };
  }
}

export async function countSessions(pattern = "session:*"): Promise<number> {
  const redis = getRedisClient();
  let total = 0;
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", "500");
    cursor = next;
    total += keys.length;
  } while (cursor !== "0");
  return total;
}

export async function listSessionsLimited(
  limit: number,
  pattern = "session:*"
): Promise<SessionEntry[]> {
  const redis = getRedisClient();
  const out: SessionEntry[] = [];
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", "200");
    cursor = next;
    if (!keys.length) continue;

    const selected = keys.slice(0, Math.max(0, limit - out.length));
    const p = redis.pipeline();
    for (const key of selected) {
      p.get(key);
      p.ttl(key);
    }
    const res = await p.exec();
    for (let i = 0; i < selected.length; i++) {
      const raw = res?.[i * 2]?.[1];
      const ttl = res?.[i * 2 + 1]?.[1];
      out.push({
        key: selected[i]!,
        ttlSeconds: typeof ttl === "number" ? ttl : null,
        value: parseValue(raw),
      });
    }
  } while (cursor !== "0" && out.length < limit);
  return out;
}

export function toSessionTree(entries: SessionEntry[]): SessionTree {
  const tree: SessionTree = {};
  for (const entry of entries) {
    const { namespace, teamId, userId } = parseKey(entry.key);
    if (!tree[namespace]) tree[namespace] = {};
    if (!tree[namespace][teamId]) tree[namespace][teamId] = {};
    tree[namespace][teamId][userId] = entry;
  }
  return tree;
}
