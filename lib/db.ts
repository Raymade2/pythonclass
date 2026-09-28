import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "fs";
import path from "path";
import { DDL } from "./ddl";

const DB_PATH = process.env.SQLITE_PATH
  ? path.isAbsolute(process.env.SQLITE_PATH)
    ? process.env.SQLITE_PATH
    : path.join(process.cwd(), process.env.SQLITE_PATH)
  : path.join(process.cwd(), "data", "sfgs.db");

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const globalForDb = globalThis as unknown as { __sfgsDb?: DatabaseSync; __sfgsSchemaReady?: boolean };

function connect(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  if (!globalForDb.__sfgsSchemaReady) {
    db.exec(DDL);
    db.exec("INSERT OR IGNORE INTO school (id) VALUES (1)");
    globalForDb.__sfgsSchemaReady = true;
  }
  return db;
}

export const db: DatabaseSync = globalForDb.__sfgsDb ?? connect();
globalForDb.__sfgsDb = db;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Normalize a JS value for SQLite binding (dates -> ISO, booleans -> 0/1). */
export function sq(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...params.map(sq)) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...params.map(sq)) as T | undefined;
}

export function run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
  const r = db.prepare(sql).run(...(params.map(sq) as never[]));
  return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}

/** Run a function inside a transaction (rolls back on error). */
export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const v = fn();
    db.exec("COMMIT");
    return v;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Convert snake_case row keys to camelCase. */
export function camelize<T>(row: Record<string, unknown> | null | undefined): T | undefined {
  if (!row) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out as T;
}

export function camelAll<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => camelize<T>(r)!) as T[];
}

/** Build an SQL fragment: "col IN (?,?...)" with placeholders. */
export function inClause(n: number): string {
  return `(${Array.from({ length: Math.max(n, 1) }, () => "?").join(",")})`;
}
