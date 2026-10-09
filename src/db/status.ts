import { getPgPool } from './postgres';

export interface PostgresTableStatus {
  tableName: string;
  rowCount: number;
  totalSize: string;
}

export interface PostgresDetailedStatus {
  connected: boolean;
  version?: string;
  databaseName?: string;
  poolSize: number;
  totalTables: number;
  migrationVersion?: string;
  tables: PostgresTableStatus[];
}

export async function getPostgresDetailedStatus(): Promise<PostgresDetailedStatus> {
  const pool = getPgPool();
  if (!pool) {
    return {
      connected: false,
      poolSize: 0,
      totalTables: 0,
      tables: [],
    };
  }

  try {
    const client = await pool.connect();
    try {
      const infoRes = await client.query(`
        SELECT current_database() as db_name, version() as pg_version;
      `);

      const tablesRes = await client.query(`
        SELECT 
          relname as table_name,
          n_live_tup as row_count,
          pg_size_pretty(pg_total_relation_size(C.oid)) as total_size
        FROM pg_class C
        LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
        WHERE nspname = 'public' AND C.relkind = 'r'
        ORDER BY relname ASC;
      `);

      let migration = 'none';
      try {
        const migRes = await client.query(`SELECT version FROM schema_migrations ORDER BY id DESC LIMIT 1;`);
        if (migRes.rows.length > 0) {
          migration = migRes.rows[0].version;
        }
      } catch {}

      return {
        connected: true,
        version: infoRes.rows[0]?.pg_version?.split(' ')?.[1] || 'PostgreSQL',
        databaseName: infoRes.rows[0]?.db_name || 'gb_telemetria',
        poolSize: pool.totalCount,
        totalTables: tablesRes.rows.length,
        migrationVersion: migration,
        tables: tablesRes.rows.map((r: any) => ({
          tableName: r.table_name,
          rowCount: parseInt(r.row_count, 10) || 0,
          totalSize: r.total_size || '0 kB',
        })),
      };
    } finally {
      client.release();
    }
  } catch {
    return {
      connected: false,
      poolSize: 0,
      totalTables: 0,
      tables: [],
    };
  }
}
