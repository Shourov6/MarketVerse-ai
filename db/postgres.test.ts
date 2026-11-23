import { describe, expect, it } from "vitest";
import { toPostgresSql } from "./postgres.ts";

describe("PostgreSQL SQL conversion", () => {
  it("converts MySQL-style identifiers and positional placeholders", () => {
    expect(toPostgresSql("SELECT * FROM `users` WHERE `id` = ? AND `role` = ?")).toBe(
      'SELECT * FROM "users" WHERE "id" = $1 AND "role" = $2'
    );
  });

  it("does not convert question marks inside SQL string literals", () => {
    expect(toPostgresSql("SELECT '?' AS marker WHERE id = ?")).toBe(
      "SELECT '?' AS marker WHERE id = $1"
    );
  });

  it("uses a PostgreSQL expression for legacy millisecond timestamp defaults", () => {
    expect(toPostgresSql("ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000)")).toBe(
      "(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT"
    );
  });
});
