import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? process.env.databaseURL;

const pool = new Pool({
  connectionString,
  ssl: connectionString
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

export default pool;