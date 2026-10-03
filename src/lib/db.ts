import { randomUUID } from "node:crypto";
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

/**
 * The MySQL connection pool (DATABASE_URL). One pool per server process; in
 * development it survives hot reloads instead of opening a new one each time.
 *
 * Values come back the way the app's types expect them:
 *   DATETIME     → ISO string, UTC ("2026-10-03T09:07:00.000Z")
 *   DATE         → "YYYY-MM-DD"
 *   BOOLEAN      → true / false (MySQL stores them as TINYINT(1))
 */
const globalForDb = globalThis as unknown as { mysqlPool?: Pool };

export const pool: Pool =
  globalForDb.mysqlPool ??
  mysql.createPool({
    uri: process.env.DATABASE_URL,
    timezone: "Z",
    connectionLimit: 10,
    dateStrings: true,
    typeCast(field, next) {
      if (field.type === "TINY" && field.length === 1) {
        const v = field.string();
        return v === null ? null : v === "1";
      }
      if (field.type === "DATETIME" || field.type === "TIMESTAMP") {
        const v = field.string();
        return v === null ? null : `${v.replace(" ", "T")}${v.includes(".") ? "" : ".000"}Z`;
      }
      return next();
    },
  });

if (process.env.NODE_ENV !== "production") globalForDb.mysqlPool = pool;

type Runner = Pool | PoolConnection;

/** All rows of a query. Values go in `params` (as ?), never into the SQL string. */
export async function rows<T>(sql: string, params: unknown[] = [], on: Runner = pool): Promise<T[]> {
  const [result] = await on.query<RowDataPacket[]>(sql, params);
  return result as T[];
}

/** The first row of a query, or null. */
export async function row<T>(sql: string, params: unknown[] = [], on: Runner = pool): Promise<T | null> {
  const list = await rows<T>(sql, params, on);
  return list[0] ?? null;
}

/** Run an INSERT / UPDATE / DELETE; returns how many rows it touched. */
export async function exec(sql: string, params: unknown[] = [], on: Runner = pool): Promise<number> {
  const [result] = await on.query<ResultSetHeader>(sql, params);
  return result.affectedRows;
}

/** A new row id. Made here (not by MySQL) so the code knows it straight away. */
export const newId = () => randomUUID();

/** Insert one row from an object; returns its id. */
export async function insert(
  table: string,
  values: Record<string, unknown>,
  on: Runner = pool,
): Promise<string> {
  const id = (values.id as string | undefined) ?? newId();
  const data = { ...values, id };
  await on.query(`INSERT INTO \`${table}\` SET ?`, [data]);
  return id;
}

/** Insert many rows of the same shape. */
export async function insertMany(
  table: string,
  list: Record<string, unknown>[],
  on: Runner = pool,
): Promise<void> {
  if (list.length === 0) return;
  const withIds: Record<string, unknown>[] = list.map((v) => ({ id: newId(), ...v }));
  const columns = Object.keys(withIds[0]);
  await on.query(
    `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES ?`,
    [withIds.map((v) => columns.map((c) => v[c]))],
  );
}

/** Update a row by id from an object. Nothing to change = nothing done. */
export async function updateById(
  table: string,
  id: string,
  values: Record<string, unknown>,
  on: Runner = pool,
): Promise<void> {
  if (Object.keys(values).length === 0) return;
  await on.query(`UPDATE \`${table}\` SET ? WHERE id = ?`, [values, id]);
}

/** Run several statements as one: all of them happen, or none do. */
export async function transaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** A unique key already has this value (e.g. a ticket number in use). */
export function isDuplicate(error: unknown): boolean {
  return (error as { code?: string })?.code === "ER_DUP_ENTRY";
}

/** A readable message from a database error. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** "?, ?, ?" for an IN (...) list. */
export const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");
