import { getDb } from "../api/queries/connection.ts";
import { closePool } from "./postgres.ts";
import "./schema.ts";
import "./aiSchema.ts";

async function clear() {
  const db = getDb();
  console.log("Clearing all seeded data from database...");
  await db.clear();

  console.log("✅ All seeded data successfully removed.");
}

clear().catch((err) => {
  console.error("❌ Error clearing data:", err);
  process.exitCode = 1;
}).finally(() => closePool());
