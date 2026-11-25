import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';
import { AppConfig, CONFIG } from '../config.provider';

// Keep the JSON shapes the Spring API produced: NUMERIC and BIGINT as numbers,
// DATE as the ISO text 'YYYY-MM-DD' (no timezone shifting). TIMESTAMPTZ stays a Date.
types.setTypeParser(1700, (v: string) => parseFloat(v)); // numeric
types.setTypeParser(20, (v: string) => Number(v)); // bigint
types.setTypeParser(1082, (v: string) => v); // date

/** Anything that can run SQL: the pool, or a transaction client. */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
}

@Injectable()
export class Db implements OnModuleDestroy {
  readonly pool: Pool;

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.pool = new Pool({ connectionString: config.databaseUrl, max: config.dbPoolSize, connectionTimeoutMillis: 10_000 });
  }

  get q(): Queryable {
    return this.pool;
  }

  /** Runs fn inside a transaction. Commits when fn resolves, rolls back when it throws. */
  async tx<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
