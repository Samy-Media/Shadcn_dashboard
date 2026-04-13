/**
 * Optional DB bootstrap for workers / scripts — not used by the Next.js API by default.
 * Re-exports the canonical pool and migrations from `./db`.
 */
export { connectDB, DB_TABLES, pool } from "./db";
