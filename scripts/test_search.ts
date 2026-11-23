import { closePool, getDb, like, or } from "../db/postgres.js";
import { products } from "../db/schema.js";

async function run() {
  try {
    const query = "Electronics";
    const res = await getDb()
      .select()
      .from(products)
      .where(or(like(products.name, `%${query}%`), like(products.description, `%${query}%`)));
    console.log("Found", res.length, "items.");
  } finally {
    await closePool();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
