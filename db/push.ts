import { closePool, getDb } from "./postgres.ts";
import "./schema.ts";
import "./aiSchema.ts";

async function pushSchema() {
  try {
    await getDb().initialize();
    console.log("Supabase PostgreSQL schema is ready.");
  } finally {
    await closePool();
  }
}

pushSchema().catch((error) => {
  console.error("Failed to initialize the PostgreSQL schema:", error);
  process.exitCode = 1;
});
