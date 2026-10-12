/**
 * MarketVerse Database Driver & ORM Layer
 *
 * Drizzle-compatible query builder running on Netlify Database (managed Postgres)
 * via `@netlify/database`. Table definitions keep the original `mysqlTable` API.
 * Features:
 *  - Connection pooling provided by Netlify Database
 *  - Type-safe Drizzle-compatible Table/Column Schema builder
 *  - Schema managed through SQL migrations in netlify/database/migrations
 *  - Raw query access and parameterized statement escaping
 */

import pg from "pg";
import { types as neonTypes } from "@neondatabase/serverless";
import { getDatabase } from "@netlify/database";

type SqlFragment = {
  sql: string;
  params: unknown[];
};

type ColumnBuilder = {
  kind: "column-builder";
  columnType: "integer" | "text" | "real";
  name: string;
  state: {
    primaryKey: boolean;
    notNull: boolean;
    unique: boolean;
    defaultValue?: unknown;
  };
  build: (tableName: string, propertyName: string) => Column;
  primaryKey: () => ColumnBuilder;
  notNull: () => ColumnBuilder;
  unique: () => ColumnBuilder;
  default: (value: unknown) => ColumnBuilder;
};

type Column = {
  kind: "column";
  tableName: string;
  name: string;
  propertyName: string;
  columnType: "integer" | "text" | "real";
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  defaultValue?: unknown;
  toString: () => string;
};

type TableDef = {
  kind: "table";
  tableName: string;
  columns: Record<string, Column>;
  columnList: Column[];
  [key: string]: unknown;
};

type OrderBy = { sql: string };

type JoinClause = {
  type: "left" | "inner";
  table: TableDef;
  condition: SqlFragment;
};

type SelectSelection = Record<string, any> | undefined;

type QueryResult = Array<any>;

const registeredTables: TableDef[] = [];

function isColumn(value: unknown): value is Column {
  return Boolean(value && typeof value === "object" && (value as Column).kind === "column");
}

function isSqlFragment(value: unknown): value is SqlFragment {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as SqlFragment).sql === "string" &&
      Array.isArray((value as SqlFragment).params)
  );
}

function quoteIdentifier(identifier: string): string {
  if (typeof identifier !== "string") {
    const fallback = identifier as { name?: unknown };
    if (fallback && typeof fallback.name === "string") {
      identifier = fallback.name;
    } else {
      identifier = String(identifier);
    }
  }
  return '"' + identifier.replace(/"/g, '""') + '"';
}

function renderValue(value: unknown): SqlFragment {
  if (isSqlFragment(value)) {
    return value;
  }
  if (isColumn(value)) {
    return {
      sql: `${quoteIdentifier(value.tableName)}.${quoteIdentifier(value.name)}`,
      params: [],
    };
  }
  if (
    value &&
    typeof value === "object" &&
    "sql" in (value as Record<string, unknown>) &&
    "params" in (value as Record<string, unknown>)
  ) {
    return value as SqlFragment;
  }
  return { sql: "?", params: [typeof value === "boolean" ? (value ? 1 : 0) : value] };
}

function renderNullable(value: unknown): SqlFragment {
  if (value === undefined || value === null) {
    return { sql: "NULL", params: [] };
  }
  return renderValue(value);
}

function combineFragments(parts: SqlFragment[], operator: string): SqlFragment {
  return {
    sql: parts.map((part) => `(${part.sql})`).join(` ${operator} `),
    params: parts.flatMap((part) => part.params),
  };
}

function buildColumn(builder: ColumnBuilder, tableName: string, propertyName: string): Column {
  return {
    kind: "column",
    tableName,
    name: builder.name,
    propertyName,
    columnType: builder.columnType,
    primaryKey: builder.state.primaryKey,
    notNull: builder.state.notNull,
    unique: builder.state.unique,
    defaultValue: builder.state.defaultValue,
    toString() {
      return `${tableName}.${builder.name}`;
    },
  };
}

function createColumnBuilder(columnType: ColumnBuilder["columnType"], name: string): ColumnBuilder {
  const builder: ColumnBuilder = {
    kind: "column-builder",
    columnType,
    name,
    state: {
      primaryKey: false,
      notNull: false,
      unique: false,
      defaultValue: undefined,
    },
    build(tableName: string, propertyName: string) {
      return buildColumn(builder, tableName, propertyName);
    },
    primaryKey() {
      builder.state.primaryKey = true;
      return builder;
    },
    notNull() {
      builder.state.notNull = true;
      return builder;
    },
    unique() {
      builder.state.unique = true;
      return builder;
    },
    default(value: unknown) {
      builder.state.defaultValue = value;
      return builder;
    },
  };

  return builder;
}

export function integer(name: string) {
  return createColumnBuilder("integer", name);
}

export function text(name: string) {
  return createColumnBuilder("text", name);
}

export function real(name: string) {
  return createColumnBuilder("real", name);
}

export function index(_name: string) {
  return {
    on(..._columns: Column[]) {
      return { name: _name };
    },
  };
}

export function mysqlTable(
  name: string,
  columns: Record<string, ColumnBuilder>,
  extras?: (table: Record<string, Column>) => unknown
) {
  const table: Record<string, Column> = {};
  const columnList: Column[] = [];

  for (const [propertyName, builder] of Object.entries(columns)) {
    const column = builder.build(name, propertyName);
    table[propertyName] = column;
    columnList.push(column);
  }

  const tableDef: TableDef = {
    kind: "table",
    tableName: name,
    columns: table,
    columnList,
  };

  Object.assign(tableDef, table);

  if (extras) {
    extras(tableDef as Record<string, Column>);
  }

  registeredTables.push(tableDef);

  return tableDef;
}

// Export alias for backward compatibility
export const sqliteTable = mysqlTable;

export function sql<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): SqlFragment {
  let sqlText = "";
  const params: unknown[] = [];

  for (let index = 0; index < strings.length; index += 1) {
    let str = strings[index];
    // Convert SQLite julianday timestamps expression to a Postgres epoch-millisecond expression
    if (str.includes("julianday('now')")) {
      str = str.replace(/\(cast\(\(julianday\('now'\) - 2440587\.5\)\*86400000 as integer\)\)/gi, "FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)");
    }
    sqlText += str;
    if (index < values.length) {
      const rendered = renderValue(values[index]);
      sqlText += rendered.sql;
      params.push(...rendered.params);
    }
  }

  return { sql: sqlText, params };
}

sql.raw = (rawSql: string): SqlFragment => ({ sql: rawSql, params: [] });

export function eq(left: unknown, right: unknown): SqlFragment {
  const renderedLeft = renderValue(left);
  const renderedRight = renderNullable(right);
  return {
    sql: `${renderedLeft.sql} = ${renderedRight.sql}`,
    params: [...renderedLeft.params, ...renderedRight.params],
  };
}

export function ne(left: unknown, right: unknown): SqlFragment {
  const renderedLeft = renderValue(left);
  const renderedRight = renderNullable(right);
  return {
    sql: `${renderedLeft.sql} != ${renderedRight.sql}`,
    params: [...renderedLeft.params, ...renderedRight.params],
  };
}

export function like(left: unknown, pattern: unknown): SqlFragment {
  const renderedLeft = renderValue(left);
  const renderedRight = renderNullable(pattern);
  return {
    sql: `${renderedLeft.sql}::text ILIKE ${renderedRight.sql}`,
    params: [...renderedLeft.params, ...renderedRight.params],
  };
}

export function and(...conditions: Array<SqlFragment | undefined | null | false>): SqlFragment {
  const parts = conditions.filter(Boolean) as SqlFragment[];
  if (parts.length === 0) {
    return { sql: "1 = 1", params: [] };
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return combineFragments(parts, "AND");
}

export function or(...conditions: Array<SqlFragment | undefined | null | false>): SqlFragment {
  const parts = conditions.filter(Boolean) as SqlFragment[];
  if (parts.length === 0) {
    return { sql: "1 = 0", params: [] };
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return combineFragments(parts, "OR");
}

export function desc(value: unknown): OrderBy {
  return { sql: `${renderValue(value).sql} DESC` };
}

export function asc(value: unknown): OrderBy {
  return { sql: `${renderValue(value).sql} ASC` };
}

export function gte(left: unknown, right: unknown): SqlFragment {
  const renderedLeft = renderValue(left);
  const renderedRight = renderNullable(right);
  return {
    sql: `${renderedLeft.sql} >= ${renderedRight.sql}`,
    params: [...renderedLeft.params, ...renderedRight.params],
  };
}

export function gt(left: unknown, right: unknown): SqlFragment {
  const renderedLeft = renderValue(left);
  const renderedRight = renderNullable(right);
  return {
    sql: `${renderedLeft.sql} > ${renderedRight.sql}`,
    params: [...renderedLeft.params, ...renderedRight.params],
  };
}

export function lte(left: unknown, right: unknown): SqlFragment {
  const renderedLeft = renderValue(left);
  const renderedRight = renderNullable(right);
  return {
    sql: `${renderedLeft.sql} <= ${renderedRight.sql}`,
    params: [...renderedLeft.params, ...renderedRight.params],
  };
}

export function inArray(column: unknown, values: unknown[]): SqlFragment {
  if (values.length === 0) {
    return { sql: "1 = 0", params: [] };
  }
  const renderedColumn = renderValue(column);
  const placeholders = values.map(() => "?").join(", ");
  return {
    sql: `${renderedColumn.sql} IN (${placeholders})`,
    params: [...renderedColumn.params, ...values],
  };
}

export function count(value?: unknown): SqlFragment {
  if (!value) {
    return { sql: "COUNT(*)", params: [] };
  }
  return { sql: `COUNT(${renderValue(value).sql})`, params: renderValue(value).params };
}

function normalizeBooleanValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return value;
}

function evaluateDefaultValue(column: Column) {
  if (column.defaultValue === undefined) {
    return undefined;
  }

  if (isSqlFragment(column.defaultValue)) {
    if (column.defaultValue.sql.includes("julianday") || column.defaultValue.sql.includes("UNIX_TIMESTAMP")) {
      return Date.now();
    }
    return column.defaultValue;
  }

  return column.defaultValue;
}

function applyRowDefaults(table: TableDef, row: Record<string, unknown>): Record<string, unknown> {
  const nextRow = { ...row };

  for (const column of table.columnList) {
    const propertyValue = nextRow[column.propertyName];
    const rawColumnValue = nextRow[column.name];

    if (propertyValue === undefined && rawColumnValue === undefined) {
      const defaultValue = evaluateDefaultValue(column);
      if (defaultValue !== undefined) {
        nextRow[column.propertyName] = defaultValue;
      }
    }
  }

  return nextRow;
}

function mapDatabaseRow(table: TableDef, row: Record<string, any>) {
  if (!row) return row;
  const mapped: Record<string, any> = {};

  for (const column of table.columnList) {
    const val = row[column.name] !== undefined ? row[column.name] : row[column.propertyName];
    mapped[column.propertyName] = val;
  }

  for (const [key, val] of Object.entries(row)) {
    if (mapped[key] === undefined) {
      mapped[key] = val;
    }
  }

  return mapped;
}

function renderSelection(selection: SelectSelection, baseTable?: TableDef): SqlFragment {
  if (!selection) {
    if (!baseTable) {
      return { sql: "*", params: [] };
    }
    const columnsSql = baseTable.columnList
      .map((column) => `${quoteIdentifier(baseTable.tableName)}.${quoteIdentifier(column.name)} AS ${quoteIdentifier(column.propertyName)}`)
      .join(", ");
    return { sql: columnsSql, params: [] };
  }

  const parts: string[] = [];
  const params: unknown[] = [];

  for (const [alias, target] of Object.entries(selection)) {
    const renderedTarget = renderValue(target);
    parts.push(`${renderedTarget.sql} AS ${quoteIdentifier(alias)}`);
    params.push(...renderedTarget.params);
  }

  return { sql: parts.join(", "), params };
}

// ─── Postgres connection (Netlify Database) ──────────────────────────────────

type PgQueryResult = { rows: any[]; rowCount?: number | null; affectedRows?: number };

export type QueryablePool = {
  query: (text: string, params?: unknown[]) => Promise<PgQueryResult>;
};

let poolInstance: QueryablePool | null = null;
let typeParsersInstalled = false;

function installTypeParsers() {
  if (typeParsersInstalled) return;
  typeParsersInstalled = true;
  // BIGINT (COUNT/ids/timestamps) and NUMERIC (SUM/AVG) come back as strings by default.
  const toNumber = (value: string | null) => (value === null ? null : Number(value));
  pg.types.setTypeParser(20, toNumber as any);
  pg.types.setTypeParser(1700, toNumber as any);
  neonTypes.setTypeParser(20, toNumber as any);
  neonTypes.setTypeParser(1700, toNumber as any);
}

/** Override the connection (used by local tooling such as the seed-data generator). */
export function setPool(pool: QueryablePool) {
  poolInstance = pool;
}

export function getPool(): QueryablePool {
  if (!poolInstance) {
    installTypeParsers();
    poolInstance = getDatabase().pool as unknown as QueryablePool;
  }
  return poolInstance;
}

/** Converts `?` placeholders to Postgres `$n` placeholders, skipping quoted literals. */
export function toPgPlaceholders(text: string): string {
  let out = "";
  let index = 0;
  let quote: string | null = null;
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      out += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else if (ch === "?") {
      index += 1;
      out += `$${index}`;
    } else {
      out += ch;
    }
  }
  return out;
}

async function runQuery(pool: QueryablePool, text: string, params: unknown[] = []) {
  const result = await pool.query(toPgPlaceholders(text), params.map(normalizeParam));
  return {
    rows: result.rows ?? [],
    changes: Number(result.rowCount ?? result.affectedRows ?? 0),
  };
}

function normalizeParam(value: unknown) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  if (value !== null && typeof value === "object" && !Buffer.isBuffer(value)) return JSON.stringify(value);
  return value;
}

/** Coerces values to fit the declared column type (Postgres is stricter than MySQL). */
function coerceForColumn(column: Column | undefined, value: unknown) {
  if (isSqlFragment(value)) value = value.params[0] ?? null;
  if (value === undefined) return null;
  if (!column) return normalizeBooleanValue(value);
  if (column.columnType === "integer") {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number" && !Number.isInteger(value)) return Math.round(value);
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Math.round(Number(value));
    }
    return value;
  }
  if (column.columnType === "real") {
    if (typeof value === "boolean") return value ? 1 : 0;
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  return value;
}

function columnSqlType(col: Column): string {
  if (col.columnType === "integer") {
    return col.primaryKey ? "BIGINT GENERATED BY DEFAULT AS IDENTITY" : "BIGINT";
  }
  if (col.columnType === "real") return "DOUBLE PRECISION";
  return "TEXT";
}

function columnDefaultSql(col: Column): string {
  const value = col.defaultValue;
  if (value === undefined || col.primaryKey) return "";
  if (isSqlFragment(value)) {
    if (value.sql.includes("UNIX_TIMESTAMP") || value.sql.includes("julianday")) {
      return " DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000))::BIGINT";
    }
    return "";
  }
  if (typeof value === "number") return ` DEFAULT ${value}`;
  if (typeof value === "boolean") return ` DEFAULT ${value ? 1 : 0}`;
  if (typeof value === "string") return ` DEFAULT '${value.replace(/'/g, "''")}'`;
  return "";
}

/** Renders CREATE TABLE statements for every registered table (used to write migrations). */
export function renderCreateTablesSql(): string {
  return registeredTables
    .map((table) => {
      const cols = table.columnList.map((col) => {
        let colSql = `${quoteIdentifier(col.name)} ${columnSqlType(col)}`;
        if (col.primaryKey) colSql += " PRIMARY KEY";
        if (col.notNull && !col.primaryKey) colSql += " NOT NULL";
        if (col.unique && !col.primaryKey) colSql += " UNIQUE";
        colSql += columnDefaultSql(col);
        return colSql;
      });
      return `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.tableName)} (\n  ${cols.join(",\n  ")}\n);`;
    })
    .join("\n\n");
}

export function getRegisteredTables() {
  return registeredTables;
}

// Schema is managed by migrations in netlify/database/migrations — no runtime DDL.
export async function ensureSchema(_pool?: QueryablePool) {}

function primaryKeyColumn(table: TableDef): Column | undefined {
  return table.columnList.find((column) => column.primaryKey);
}

class SelectQuery {
  private readonly pool: QueryablePool;
  private readonly selection: SelectSelection;
  private baseTable?: TableDef;
  private joins: JoinClause[] = [];
  private whereClause?: SqlFragment;
  private groupByClauses: SqlFragment[] = [];
  private orderByClauses: OrderBy[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(pool: QueryablePool, selection?: SelectSelection) {
    this.pool = pool;
    this.selection = selection;
  }

  from(table: TableDef) {
    this.baseTable = table;
    return this;
  }

  leftJoin(table: TableDef, condition: SqlFragment) {
    this.joins.push({ type: "left", table, condition });
    return this;
  }

  innerJoin(table: TableDef, condition: SqlFragment) {
    this.joins.push({ type: "inner", table, condition });
    return this;
  }

  where(condition?: SqlFragment) {
    if (condition) {
      this.whereClause = condition;
    }
    return this;
  }

  groupBy(...clauses: Array<any>) {
    this.groupByClauses.push(
      ...clauses.map((clause) =>
        isColumn(clause)
          ? renderValue(clause)
          : isSqlFragment(clause)
          ? clause
          : { sql: String(clause), params: [] }
      )
    );
    return this;
  }

  orderBy(...clauses: Array<any>) {
    for (const clause of clauses) {
      if (clause && typeof clause === "object" && "sql" in clause && typeof clause.sql === "string") {
        this.orderByClauses.push(clause as OrderBy);
      } else if (isColumn(clause)) {
        this.orderByClauses.push({ sql: renderValue(clause).sql });
      }
    }
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  offset(value: number) {
    this.offsetValue = value;
    return this;
  }

  toSQL() {
    if (!this.baseTable) {
      throw new Error("from() must be called before executing the query");
    }

    const selection = renderSelection(this.selection, this.baseTable);
    const params: unknown[] = [...selection.params];
    const parts = [`SELECT ${selection.sql} FROM ${quoteIdentifier(this.baseTable.tableName)}`];

    for (const join of this.joins) {
      const joinSql = `${join.type === "left" ? "LEFT JOIN" : "INNER JOIN"} ${quoteIdentifier(join.table.tableName)} ON ${join.condition.sql}`;
      parts.push(joinSql);
      params.push(...join.condition.params);
    }

    if (this.whereClause) {
      parts.push(`WHERE ${this.whereClause.sql}`);
      params.push(...this.whereClause.params);
    }

    if (this.groupByClauses.length > 0) {
      parts.push(`GROUP BY ${this.groupByClauses.map((clause) => clause.sql).join(", ")}`);
      for (const clause of this.groupByClauses) {
        params.push(...clause.params);
      }
    }

    if (this.orderByClauses.length > 0) {
      parts.push(`ORDER BY ${this.orderByClauses.map((clause) => clause.sql).join(", ")}`);
    }

    if (this.limitValue !== undefined) {
      parts.push(`LIMIT ${Math.max(0, Math.floor(Number(this.limitValue)) || 0)}`);
    }

    if (this.offsetValue !== undefined) {
      parts.push(`OFFSET ${Math.max(0, Math.floor(Number(this.offsetValue)) || 0)}`);
    }

    return { sql: parts.join(" "), params };
  }

  async all() {
    const { sql: querySql, params } = this.toSQL();
    const { rows } = await runQuery(this.pool, querySql, params);

    if (!this.selection && this.baseTable) {
      return rows.map((row) => mapDatabaseRow(this.baseTable as TableDef, applyRowDefaults(this.baseTable as TableDef, row)));
    }
    return rows;
  }

  async get() {
    const rows = await this.all();
    return rows[0];
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.all()).then(onfulfilled, onrejected);
  }
}

class InsertQuery {
  private readonly pool: QueryablePool;
  private readonly table: TableDef;
  private valuesData: Record<string, unknown> | Record<string, unknown>[] = {};
  private conflictTarget?: Column;
  private conflictSet?: Record<string, unknown>;

  constructor(pool: QueryablePool, table: TableDef) {
    this.pool = pool;
    this.table = table;
  }

  values(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.valuesData = values;
    return this;
  }

  onDuplicateKeyUpdate(options: { set: Record<string, unknown> }) {
    // MySQL resolves against any unique key; Postgres needs an explicit target.
    const valuesArray = Array.isArray(this.valuesData) ? this.valuesData : [this.valuesData];
    const uniqueProvided = this.table.columnList.find(
      (column) => column.unique && !column.primaryKey && valuesArray[0]?.[column.propertyName] !== undefined
    );
    this.conflictTarget = uniqueProvided ?? primaryKeyColumn(this.table) ?? this.table.columnList[0];
    this.conflictSet = options.set;
    return this;
  }

  onConflictDoUpdate(options: { target: Column | Column[]; set: Record<string, unknown> }) {
    this.conflictTarget = Array.isArray(options.target) ? options.target[0] : options.target;
    this.conflictSet = options.set;
    return this;
  }

  async execute() {
    const valuesArray = Array.isArray(this.valuesData) ? this.valuesData : [this.valuesData];
    if (valuesArray.length === 0) {
      return [];
    }

    const rows = valuesArray.map((row) => applyRowDefaults(this.table, row));
    const insertColumns = this.table.columnList.filter((column) =>
      rows.some((row) => row[column.propertyName] !== undefined)
    );

    const pk = primaryKeyColumn(this.table);
    const columnSql = insertColumns.map((column) => quoteIdentifier(column.name)).join(", ");
    const placeholders = rows.map(() => `(${insertColumns.map(() => "?").join(", ")})`).join(", ");
    const params = rows.flatMap((row) =>
      insertColumns.map((column) => coerceForColumn(column, row[column.propertyName]))
    );

    let sqlText = insertColumns.length
      ? `INSERT INTO ${quoteIdentifier(this.table.tableName)} (${columnSql}) VALUES ${placeholders}`
      : `INSERT INTO ${quoteIdentifier(this.table.tableName)} DEFAULT VALUES`;

    if (this.conflictTarget && this.conflictSet) {
      const entries = Object.entries(this.conflictSet).filter(([key]) => {
        const column = this.table.columns[key];
        return column && !column.primaryKey && column !== this.conflictTarget;
      });
      if (entries.length > 0) {
        const updateAssignments = entries
          .map(([key]) => `${quoteIdentifier(this.table.columns[key].name)} = ?`)
          .join(", ");
        sqlText += ` ON CONFLICT (${quoteIdentifier(this.conflictTarget.name)}) DO UPDATE SET ${updateAssignments}`;
        params.push(...entries.map(([key, value]) => coerceForColumn(this.table.columns[key], value)));
      } else {
        sqlText += ` ON CONFLICT (${quoteIdentifier(this.conflictTarget.name)}) DO NOTHING`;
      }
    }

    if (pk) {
      sqlText += ` RETURNING ${quoteIdentifier(pk.name)} AS "insertId"`;
    }

    const result = await runQuery(this.pool, sqlText, params);
    const lastId = result.rows.length ? result.rows[result.rows.length - 1].insertId : 0;
    const insertId = typeof lastId === "number" || /^\d+$/.test(String(lastId)) ? Number(lastId) : lastId;
    return [{ insertId, lastInsertRowid: insertId, changes: result.changes }];
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class UpdateQuery {
  private readonly pool: QueryablePool;
  private readonly table: TableDef;
  private setValues: Record<string, unknown> = {};
  private whereClause?: SqlFragment;

  constructor(pool: QueryablePool, table: TableDef) {
    this.pool = pool;
    this.table = table;
  }

  set(values: Record<string, unknown>) {
    this.setValues = values;
    return this;
  }

  where(condition?: SqlFragment) {
    if (condition) {
      this.whereClause = condition;
    }
    return this;
  }

  async execute() {
    const assignments: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(this.setValues)) {
      if (value === undefined) continue;
      const schemaColumn = this.table.columns[key];
      const columnName = quoteIdentifier(schemaColumn ? schemaColumn.name : key);
      // Allow expressions such as sql`${col} + 1`
      if (isSqlFragment(value) && value.sql.trim() !== "?") {
        assignments.push(`${columnName} = ${value.sql}`);
        params.push(...value.params);
      } else {
        assignments.push(`${columnName} = ?`);
        params.push(coerceForColumn(schemaColumn, value));
      }
    }
    if (assignments.length === 0) {
      return { changes: 0 };
    }
    let sqlText = `UPDATE ${quoteIdentifier(this.table.tableName)} SET ${assignments.join(", ")}`;
    if (this.whereClause) {
      sqlText += ` WHERE ${this.whereClause.sql}`;
      params.push(...this.whereClause.params);
    }
    const result = await runQuery(this.pool, sqlText, params);
    return { changes: result.changes };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class DeleteQuery {
  private readonly pool: QueryablePool;
  private readonly table: TableDef;
  private whereClause?: SqlFragment;

  constructor(pool: QueryablePool, table: TableDef) {
    this.pool = pool;
    this.table = table;
  }

  where(condition?: SqlFragment) {
    if (condition) {
      this.whereClause = condition;
    }
    return this;
  }

  async execute() {
    let sqlText = `DELETE FROM ${quoteIdentifier(this.table.tableName)}`;
    const params: unknown[] = [];
    if (this.whereClause) {
      sqlText += ` WHERE ${this.whereClause.sql}`;
      params.push(...this.whereClause.params);
    }
    const result = await runQuery(this.pool, sqlText, params);
    return { changes: result.changes };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export function getDb() {
  const pool = getPool();

  return {
    select(selection?: SelectSelection) {
      return new SelectQuery(pool, selection);
    },
    insert(table: TableDef) {
      return new InsertQuery(pool, table);
    },
    update(table: TableDef) {
      return new UpdateQuery(pool, table);
    },
    delete(table: TableDef) {
      return new DeleteQuery(pool, table);
    },
    async execute(fragment: SqlFragment | string) {
      const query = typeof fragment === "string" ? { sql: fragment, params: [] } : fragment;
      const { rows } = await runQuery(pool, query.sql, query.params);
      return rows;
    },
    async prepare(sqlText: string) {
      return {
        async run(...params: unknown[]) {
          const result = await runQuery(pool, sqlText, params);
          return { lastInsertRowid: Number(result.rows[0]?.id ?? 0), changes: result.changes };
        },
        async get(...params: unknown[]) {
          const { rows } = await runQuery(pool, sqlText, params);
          return rows[0];
        },
        async all(...params: unknown[]) {
          const { rows } = await runQuery(pool, sqlText, params);
          return rows;
        },
      };
    },
    raw() {
      return pool;
    },
    // Statements run on the shared pool; the callback receives no dedicated connection.
    async transaction<T>(callback: (connection?: unknown) => T | Promise<T>) {
      return callback();
    },
  };
}

export type { Column, TableDef, SqlFragment };
