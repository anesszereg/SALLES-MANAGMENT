import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';

try {
  process.loadEnvFile('.env.local');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('sslmode', 'verify-full');
const pool = new Pool({ connectionString: url.toString(), enableChannelBinding: true, max: 1, connectionTimeoutMillis: 15000 });
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("select pg_advisory_xact_lock(hashtext('lune-benif-schema'))");
  await client.query(await readFile(new URL('../src/lib/schema.sql', import.meta.url), 'utf8'));
  await client.query("set time zone 'Africa/Algiers'");
  await client.query('COMMIT');
  const result = await client.query(`select
    (select count(*)::int from products) products,
    (select count(*)::int from customers) customers,
    (select count(*)::int from suppliers) suppliers,
    (select count(*)::int from purchase_invoices) purchases,
    (select count(*)::int from sales_invoices) sales,
    (select count(*)::int from production_batches) production_batches,
    (select count(*)::int from expenses) expenses,
    (select count(*)::int from stock_movements) stock_movements,
    (select count(*)::int from financial_transactions) financial_transactions`);
  console.log('Connected to PostgreSQL. Schema initialized without demo data.');
  console.log(result.rows[0]);
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error('Database initialization failed.', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
