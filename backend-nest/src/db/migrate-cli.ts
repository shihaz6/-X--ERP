import { Pool } from 'pg';
import { loadConfig } from '../config';
import { migrate } from './migrate';

/** Command line entry point: npm run migrate. */
async function main(): Promise<void> {
  const config = loadConfig();
  const pool = new Pool({ connectionString: config.databaseUrl, max: 1 });
  try {
    const ran = await migrate(pool);
    console.log(ran.length ? `Applied: ${ran.join(', ')}` : 'Database is up to date.');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
