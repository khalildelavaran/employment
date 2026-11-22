import 'dotenv/config';
import { checkDatabaseHealth, closeD1Database, runDatabaseMigrations } from '../src/db/d1Adapter.ts';

function main(): void {
  try {
    const result = runDatabaseMigrations();
    const health = checkDatabaseHealth();

    if (!health.ok) {
      console.error('[db:migrate] Database health verification failed:', health.error);
      closeD1Database();
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          status: 'ok',
          db_path: result.dbPath,
          applied_migrations: result.applied,
          skipped_migrations: result.skipped,
          tables_count: health.tablesCount,
          journal_mode: health.journalMode,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );
    closeD1Database();
    process.exit(0);
  } catch (err) {
    console.error('[db:migrate] Migration failed:', err instanceof Error ? err.message : err);
    closeD1Database();
    process.exit(1);
  }
}

main();
