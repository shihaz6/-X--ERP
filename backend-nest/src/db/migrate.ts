import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

/**
 * Applies the SQL files in migrations/ (V1__..., V2__...) in order.
 * A database already migrated by the Spring/Flyway backend is recognised through its
 * flyway_schema_history table, so versions it has applied are skipped. Anything else is
 * recorded in schema_migrations. Each file runs in its own transaction.
 */
export async function migrate(pool: Pool, dir = join(__dirname, '..', '..', 'migrations')): Promise<string[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  const applied = new Set<number>();
  const flyway = await pool.query<{ exists: boolean }>(`SELECT to_regclass('public.flyway_schema_history') IS NOT NULL AS exists`);
  if (flyway.rows[0]?.exists) {
    const rows = await pool.query<{ version: string }>(`SELECT version FROM flyway_schema_history WHERE success`);
    rows.rows.forEach(r => applied.add(Number(r.version)));
  }
  const own = await pool.query<{ version: number }>(`SELECT version FROM schema_migrations`);
  own.rows.forEach(r => applied.add(r.version));

  const files = readdirSync(dir)
    .map(name => ({ name, match: /^V(\d+)__.+\.sql$/.exec(name) }))
    .filter((f): f is { name: string; match: RegExpExecArray } => f.match !== null)
    .map(f => ({ name: f.name, version: Number(f.match[1]) }))
    .sort((a, b) => a.version - b.version);

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file.version)) continue;
    const sql = readFileSync(join(dir, file.name), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [file.version, file.name]);
      await client.query('COMMIT');
      ran.push(file.name);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error(`Migration ${file.name} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return ran;
}
