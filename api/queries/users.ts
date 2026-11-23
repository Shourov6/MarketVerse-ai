import { eq } from "@db/postgres";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

export async function findUserByPhone(phone: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.phone, phone))
    .limit(1);
  return rows.at(0);
}

export async function upsertUser(data: any) {
  const values = { ...data };
  const updateSet: any = {
    lastSignInAt: Date.now(),
    ...data,
  };

  if (
    values.role === undefined &&
    values.unionId &&
    values.unionId === env.ownerUnionId
  ) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await getDb()
    .insert(schema.users)
    .values(values)
    .onConflictDoUpdate({ target: schema.users.unionId, set: updateSet });
}
