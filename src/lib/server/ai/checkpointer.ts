import { Pool } from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

/**
 * Singleton Postgres-backed checkpointer for the coaching graph.
 *
 * `PostgresSaver.setup()` runs once at startup to create its tables, so an
 * interrupted conversation (paused mid question) survives a server restart and
 * can be resumed with the same thread_id.
 *
 * Managed Postgres (Supabase/Neon) requires TLS, which `fromConnString` cannot
 * configure — so the pool is built explicitly and honors `DATABASE_SSL`.
 */

const connectionString =
  process.env.DATABASE_URL ?? "postgres://fitcoach:root@localhost:5432/fitcoach";

let saverPromise: Promise<PostgresSaver> | null = null;

async function createSaver(): Promise<PostgresSaver> {
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
  });
  const saver = new PostgresSaver(pool);
  await saver.setup();
  return saver;
}

/** Get (and lazily initialize) the shared PostgresSaver. */
export function getPostgresSaver(): Promise<PostgresSaver> {
  if (!saverPromise) {
    saverPromise = createSaver().catch((error) => {
      saverPromise = null;
      throw error;
    });
  }
  return saverPromise;
}