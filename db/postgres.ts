/**
 * PostgreSQL database driver and compatibility query layer for Supabase.
 * 
 * PostgreSQL is used by Supabase and local PostgreSQL installations.
 * Features:
 *  - Connection pooling with `pg`
 *  - Type-safe Drizzle-compatible Table/Column Schema builder
 *  - Automatic table creation on startup
 *  - Parameterized queries and transaction support
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, types, type PoolClient, type QueryResult } from "pg";
import { env } from "../api/lib/env.ts";

type SqlFragment<T = unknown> = {
  sql: string;
  params: unknown[];
  readonly _type?: T;
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

// Query result columns are dynamic because table selections are assembled at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DynamicValue = any;
type SelectSelection = Record<string, DynamicValue> | undefined;

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
  return `"${identifier.replace(/"/g, '""')}"`;
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
  return { sql: "?", params: [value] };
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
    on(...columns: Column[]) {
      void columns;
      return { name: _name };
    },
  };
}

export function pgTable(
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

export function sql<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): SqlFragment<T> {
  let sqlText = "";
  const params: unknown[] = [];

  for (let index = 0; index < strings.length; index += 1) {
    const str = strings[index];
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
    sql: `${renderedLeft.sql} ${right === null || right === undefined ? "IS" : "="} ${renderedRight.sql}`,
    params: [...renderedLeft.params, ...renderedRight.params],
  };
}

export function ne(left: unknown, right: unknown): SqlFragment {
  const renderedLeft = renderValue(left);
  const renderedRight = renderNullable(right);
  return {
    sql: `${renderedLeft.sql} ${right === null || right === undefined ? "IS NOT" : "<>"} ${renderedRight.sql}`,
    params: [...renderedLeft.params, ...renderedRight.params],
  };
}

export function like(left: unknown, pattern: unknown): SqlFragment {
  const renderedLeft = renderValue(left);
  const renderedRight = renderNullable(pattern);
  return {
    sql: `${renderedLeft.sql} ILIKE ${renderedRight.sql}`,
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

function normalizeColumnValue(value: unknown, column?: Column) {
  if (value instanceof Date && column?.columnType === "integer") {
    return value.getTime();
  }
  return normalizeBooleanValue(value);
}

function evaluateDefaultValue(column: Column) {
  if (column.defaultValue === undefined) {
    return undefined;
  }

  if (isSqlFragment(column.defaultValue)) {
    if (
      column.defaultValue.sql.includes("julianday") ||
      column.defaultValue.sql.includes("UNIX_TIMESTAMP") ||
      column.defaultValue.sql.includes("EXTRACT(EPOCH")
    ) {
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

function mapDatabaseRow(table: TableDef, row: Record<string, unknown>): DynamicValue {
  if (!row) return row;
  const mapped: Record<string, unknown> = {};

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

types.setTypeParser(20, (value) => Number(value));

type PgExecutionResult = [DynamicValue[], { insertId: number; affectedRows: number }];

export function toPostgresSql(sqlText: string): string {
  const normalizedSql = sqlText
    .replace(/`([^`]+)`/g, (_match, identifier: string) => quoteIdentifier(identifier))
    .replace(/ROUND\(UNIX_TIMESTAMP\(NOW\(3\)\) \* 1000\)/gi, "(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT");

  let parameterIndex = 0;
  let quote: "'" | '"' | null = null;
  let convertedSql = "";

  for (let index = 0; index < normalizedSql.length; index += 1) {
    const character = normalizedSql[index];
    if (quote) {
      convertedSql += character;
      if (character === quote) {
        if (normalizedSql[index + 1] === quote) {
          convertedSql += normalizedSql[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
    } else if (character === "'" || character === '"') {
      quote = character;
      convertedSql += character;
    } else if (character === "?") {
      convertedSql += `$${++parameterIndex}`;
    } else {
      convertedSql += character;
    }
  }

  return convertedSql;
}

class PostgresPool {
  private readonly pool: Pool;
  private readonly transactionClient = new AsyncLocalStorage<PoolClient>();

  constructor(connectionString: string) {
    if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
      throw new Error("DATABASE_URL must be a PostgreSQL connection string from your Supabase project.");
    }

    this.pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
    this.pool.on("error", (error) => {
      console.error("[Database] Unexpected PostgreSQL pool error:", error);
    });
  }

  async query(sqlText: string, params: unknown[] = []): Promise<PgExecutionResult> {
    const statement = toPostgresSql(sqlText);
    const client = this.transactionClient.getStore();
    const result: QueryResult = await (client ?? this.pool).query(statement, params as never[]);
    return [
      result.rows,
      {
        insertId: Number(result.rows[0]?.id ?? 0),
        affectedRows: result.rowCount ?? 0,
      },
    ];
  }

  async transaction<T>(callback: () => T | Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await this.transactionClient.run(client, callback);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async clearManagedData(tableNames: string[]) {
    if (tableNames.length === 0) return;
    const tables = tableNames.map((name) => quoteIdentifier(name)).join(", ");
    await this.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  }

  async end() {
    await this.pool.end();
  }
}

let poolInstance: PostgresPool | null = null;

export function getPool(): PostgresPool {
  if (!poolInstance) {
    poolInstance = new PostgresPool(env.databaseUrl);
  }
  return poolInstance;
}

export async function closePool() {
  if (!poolInstance) return;
  const pool = poolInstance;
  poolInstance = null;
  await pool.end();
}

let schemaPromise: Promise<void> | null = null;

function defaultSql(value: unknown): string | undefined {
  if (isSqlFragment(value)) {
    return toPostgresSql(value.sql);
  }
  if (typeof value === "string") {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return undefined;
}

export async function ensureSchema(pool: PostgresPool) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const table of registeredTables) {
        const colDefinitions = table.columnList.map((col) => {
          let typeDef = "TEXT";
          if (col.columnType === "integer") {
            typeDef = col.primaryKey ? "BIGSERIAL" : "BIGINT";
          } else if (col.columnType === "real") {
            typeDef = "DOUBLE PRECISION";
          }

          let colSql = `${quoteIdentifier(col.name)} ${typeDef}`;
          if (col.primaryKey) colSql += " PRIMARY KEY";
          if (col.notNull && !col.primaryKey) colSql += " NOT NULL";
          if (col.unique && !col.primaryKey) colSql += " UNIQUE";
          const defaultValue = defaultSql(col.defaultValue);
          if (defaultValue !== undefined) colSql += ` DEFAULT ${defaultValue}`;
          return colSql;
        });

        await pool.query(
          `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.tableName)} (${colDefinitions.join(", ")})`
        );
        await pool.query(
          `ALTER TABLE ${quoteIdentifier(table.tableName)} ENABLE ROW LEVEL SECURITY`
        );
      }
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;
}

class SelectQuery {
  private readonly pool: PostgresPool;
  private readonly selection: SelectSelection;
  private baseTable?: TableDef;
  private joins: JoinClause[] = [];
  private whereClause?: SqlFragment;
  private groupByClauses: SqlFragment[] = [];
  private orderByClauses: OrderBy[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(pool: PostgresPool, selection?: SelectSelection) {
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

  groupBy(...clauses: unknown[]) {
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

  orderBy(...clauses: unknown[]) {
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
    const params: unknown[] = [];
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
      parts.push(`LIMIT ${this.limitValue}`);
    }

    if (this.offsetValue !== undefined) {
      parts.push(`OFFSET ${this.offsetValue}`);
    }

    return { sql: parts.join(" "), params };
  }

  async all(): Promise<DynamicValue[]> {
    await ensureSchema(this.pool);
    const { sql: querySql, params } = this.toSQL();
    const [rows] = await this.pool.query(querySql, params);

    if (!this.selection && this.baseTable) {
      return rows.map((row) => mapDatabaseRow(this.baseTable as TableDef, applyRowDefaults(this.baseTable as TableDef, row)));
    }
    return rows;
  }

  async get(): Promise<DynamicValue | undefined> {
    const rows = await this.all();
    return rows[0];
  }

  then<TResult1 = DynamicValue[], TResult2 = never>(
    onfulfilled?: ((value: DynamicValue[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.all()).then(onfulfilled, onrejected);
  }
}

class InsertQuery {
  private readonly pool: PostgresPool;
  private readonly table: TableDef;
  private valuesData: Record<string, unknown> | Record<string, unknown>[] = {};
  private conflictTarget?: Column;
  private conflictSet?: Record<string, unknown>;

  constructor(pool: PostgresPool, table: TableDef) {
    this.pool = pool;
    this.table = table;
  }

  values(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.valuesData = values;
    return this;
  }

  onDuplicateKeyUpdate(options: { set: Record<string, unknown> }) {
    this.conflictTarget = this.table.columns.unionId ?? this.table.columns.id ?? this.table.columnList[0];
    this.conflictSet = options.set;
    return this;
  }

  onConflictDoUpdate(options: { target: unknown; set: Record<string, unknown> }) {
    const target = Array.isArray(options.target) ? options.target[0] : options.target;
    if (!isColumn(target)) {
      throw new Error("onConflictDoUpdate requires a database column as its conflict target");
    }
    this.conflictTarget = target;
    this.conflictSet = options.set;
    return this;
  }

  private async execute() {
    await ensureSchema(this.pool);
    const valuesArray = Array.isArray(this.valuesData) ? this.valuesData : [this.valuesData];
    if (valuesArray.length === 0) {
      return [];
    }

    const rows = valuesArray.map((row) => applyRowDefaults(this.table, row));
    const columns = Array.from(
      new Set(
        rows.flatMap((row) =>
          this.table.columnList
            .filter((column) => row[column.propertyName] !== undefined)
            .map((column) => column.name)
        )
      )
    );

    const insertColumns = [...columns];
    const columnSql = insertColumns.map((column) => quoteIdentifier(column)).join(", ");
    const placeholders = rows.map(() => `(${insertColumns.map(() => "?").join(", ")})`).join(", ");
    const params = rows.flatMap((row) =>
      insertColumns.map((column) => {
        const schemaColumn = this.table.columnList.find((candidate) => candidate.name === column);
        const rawVal = schemaColumn ? row[schemaColumn.propertyName] : row[column];
        return normalizeColumnValue(isSqlFragment(rawVal) ? rawVal.params[0] ?? null : rawVal, schemaColumn);
      })
    );

    let sqlText = `INSERT INTO ${quoteIdentifier(this.table.tableName)} (${columnSql}) VALUES ${placeholders}`;

    if (this.conflictTarget && this.conflictSet) {
      const updateAssignments = Object.entries(this.conflictSet)
        .map(([key]) => {
          const column = this.table.columns[key];
          const name = column?.name ?? key;
          const valueColumnIsInserted = insertColumns.includes(name);
          if (valueColumnIsInserted) {
            return `${quoteIdentifier(name)} = EXCLUDED.${quoteIdentifier(name)}`;
          }
          const value = this.conflictSet?.[key];
          params.push(
            normalizeColumnValue(
              isSqlFragment(value) ? value.params[0] ?? null : value,
              column
            )
          );
          return `${quoteIdentifier(name)} = ?`;
        })
        .join(", ");
      sqlText += ` ON CONFLICT (${quoteIdentifier(this.conflictTarget.name)}) DO UPDATE SET ${updateAssignments}`;
    }

    sqlText += ` RETURNING ${quoteIdentifier(this.table.columns.id?.name ?? this.table.columnList[0].name)}`;
    const [, result] = await this.pool.query(sqlText, params);
    const idColumn = this.table.columns.id;
    if (
      idColumn?.columnType === "integer" &&
      insertColumns.includes(idColumn.name)
    ) {
      await this.pool.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), GREATEST(COALESCE((SELECT MAX(${quoteIdentifier(idColumn.name)}) FROM ${quoteIdentifier(this.table.tableName)}), 1), 1), true)`,
        [this.table.tableName]
      );
    }
    return [{ insertId: result.insertId, changes: result.affectedRows }];
  }

  then<TResult1 = Array<{ insertId: number; changes: number }>, TResult2 = never>(
    onfulfilled?: ((value: Array<{ insertId: number; changes: number }>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class UpdateQuery {
  private readonly pool: PostgresPool;
  private readonly table: TableDef;
  private setValues: Record<string, unknown> = {};
  private whereClause?: SqlFragment;

  constructor(pool: PostgresPool, table: TableDef) {
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

  private async execute() {
    await ensureSchema(this.pool);
    const assignments = Object.entries(this.setValues)
      .map(([key]) => {
        const schemaColumn = this.table.columns[key];
        return `${quoteIdentifier(schemaColumn ? schemaColumn.name : key)} = ?`;
      })
      .join(", ");
    const params = Object.entries(this.setValues).map(([key, value]) => {
      return normalizeColumnValue(
        isSqlFragment(value) ? value.params[0] ?? null : value,
        this.table.columns[key]
      );
    });
    let sqlText = `UPDATE ${quoteIdentifier(this.table.tableName)} SET ${assignments}`;
    if (this.whereClause) {
      sqlText += ` WHERE ${this.whereClause.sql}`;
      params.push(...this.whereClause.params);
    }
    const [, result] = await this.pool.query(sqlText, params);
    return { changes: result.affectedRows };
  }

  then<TResult1 = { changes: number }, TResult2 = never>(
    onfulfilled?: ((value: { changes: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class DeleteQuery {
  private readonly pool: PostgresPool;
  private readonly table: TableDef;
  private whereClause?: SqlFragment;

  constructor(pool: PostgresPool, table: TableDef) {
    this.pool = pool;
    this.table = table;
  }

  where(condition?: SqlFragment) {
    if (condition) {
      this.whereClause = condition;
    }
    return this;
  }

  private async execute() {
    await ensureSchema(this.pool);
    let sqlText = `DELETE FROM ${quoteIdentifier(this.table.tableName)}`;
    const params: unknown[] = [];
    if (this.whereClause) {
      sqlText += ` WHERE ${this.whereClause.sql}`;
      params.push(...this.whereClause.params);
    }
    const [, result] = await this.pool.query(sqlText, params);
    return { changes: result.affectedRows };
  }

  then<TResult1 = { changes: number }, TResult2 = never>(
    onfulfilled?: ((value: { changes: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
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
      await ensureSchema(pool);
      const query = typeof fragment === "string" ? { sql: fragment, params: [] } : fragment;
      const [rows] = await pool.query(query.sql, query.params);
      return rows;
    },
    async initialize() {
      await ensureSchema(pool);
    },
    async clear() {
      await ensureSchema(pool);
      await pool.clearManagedData(registeredTables.map((table) => table.tableName));
    },
    async prepare(sqlText: string) {
      await ensureSchema(pool);
      return {
        async run(...params: unknown[]) {
          const [rows, result] = await pool.query(sqlText, params);
          return { lastInsertRowid: result.insertId, insertId: result.insertId, changes: result.affectedRows, rows };
        },
        async get(...params: unknown[]) {
          const [rows] = await pool.query(sqlText, params);
          return rows[0];
        },
        async all(...params: unknown[]) {
          const [rows] = await pool.query(sqlText, params);
          return rows;
        },
      };
    },
    raw() {
      return pool;
    },
    async transaction<T>(callback: () => T | Promise<T>) {
      await ensureSchema(pool);
      return pool.transaction(callback);
    },
  };
}

export type { Column, TableDef, SqlFragment };
