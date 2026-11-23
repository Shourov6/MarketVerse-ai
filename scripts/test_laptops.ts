import { closePool, getDb, like } from "../db/postgres.js";
import { products } from "../db/schema.js";

async function run() {
  try {
    const allLaptops = await getDb().select().from(products).where(like(products.name, "%laptop%"));
    console.log("All laptops in DB:");
    allLaptops.forEach(p => console.log(`${p.name} - ${p.price} BDT - ID: ${p.id} - Attrs: ${p.attributes}`));
  } finally {
    await closePool();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
