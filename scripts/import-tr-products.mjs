import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

try {
  process.loadEnvFile('.env.local');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const categoryName = process.argv.find(arg => arg.startsWith('--category='))?.slice('--category='.length) ?? 'TR';
const files = { TR: 'furniture_TR_models.json', AR: 'furniture_AR_final.json' };
assert(Object.hasOwn(files, categoryName), 'Category must be TR or AR');
const source = JSON.parse(await readFile(new URL(`../Data/${files[categoryName]}`, import.meta.url), 'utf8'));
assert(Array.isArray(source) && source.length > 0, 'Expected a nonempty product array');
const normalize = name => name.trim().replace(/\s+/g, ' ').toUpperCase();
const unique = new Map();
for (const [index, item] of source.entries()) {
  assert(item && typeof item.name === 'string' && item.name.trim(), `Missing name at row ${index + 1}`);
  assert(item.type === categoryName, `Unexpected category at row ${index + 1}`);
  assert(Number.isFinite(item.size) && item.size > 0, `Invalid size at row ${index + 1}`);
  assert(item.color === null || (typeof item.color === 'string' && item.color.trim()), `Invalid color at row ${index + 1}`);
  assert(item.cost === null || (Number.isFinite(item.cost) && item.cost >= 0), `Invalid source cost at row ${index + 1}`);
  const key = normalize(item.name);
  if (unique.has(key)) {
    const previous = unique.get(key);
    assert(previous.size === item.size && previous.color === item.color && previous.cost === item.cost,
      `Conflicting duplicate product: ${item.name}`);
  } else unique.set(key, item);
}

assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('sslmode', 'verify-full');
const pool = new Pool({ connectionString: url.toString(), enableChannelBinding: true, max: 1, connectionTimeoutMillis: 15000 });
const dryRun = process.argv.includes('--dry-run');
let client;
let committed = false;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("select pg_advisory_xact_lock(hashtext('lune-benif-tr-import'))");
  const snapshot = async () => (await client.query(`select
    (select count(*)::int from financial_transactions) financial_transactions,
    (select count(*)::int from sales_invoices) sales,
    (select count(*)::int from purchase_invoices) purchases,
    (select count(*)::int from customer_payments) customer_payments,
    (select count(*)::int from supplier_payments) supplier_payments,
    (select count(*)::int from production_batches) production_batches,
    (select count(*)::int from expenses) expenses,
    (select count(*)::int from stock_movements) stock_movements,
    (select count(*)::int from inventory_adjustments) inventory_adjustments,
    (select coalesce(sum(stock * avg_cost),0)::numeric(18,2)::text from products) inventory_value`)).rows[0];
  const before = await snapshot();
  const existing = (await client.query('select id, name, reference from products')).rows;
  const names = new Set(existing.map(row => normalize(row.name)));
  const refs = new Set(existing.map(row => row.reference));
  const pending = [...unique.entries()].filter(([key]) => !names.has(key));
  console.log({ mode: dryRun ? 'dry-run' : 'import', sourceRows: source.length, uniqueProducts: unique.size,
    duplicateRows: source.length - unique.size, existingSkipped: unique.size - pending.length, toImport: pending.length });

  if (dryRun) {
    console.log('Current accounting records:', before);
    await client.query('ROLLBACK');
  } else {
    let category = (await client.query('select id from categories where name=$1 order by created_at limit 1', [categoryName])).rows[0];
    if (!category) category = (await client.query('insert into categories(name) values($1) returning id', [categoryName])).rows[0];
    const insertedIds = [];
    for (const [key, item] of pending) {
      const reference = `${categoryName}-${createHash('sha256').update(key).digest('hex').slice(0, 12).toUpperCase()}`;
      assert(!refs.has(reference), 'Product reference collision; import aborted');
      refs.add(reference);
      const description = `Size: ${item.size}\nColor: ${item.color ?? 'Not provided'}\nSource cost (reference only): ${item.cost === null ? 'Not provided' : `${item.cost} DA`}`;
      const result = await client.query(`insert into products
        (reference,name,category_id,type,description,selling_price,stock,min_stock,avg_cost)
        values($1,$2,$3,'manufactured',$4,0,0,0,0) returning id`,
      [reference, item.name.trim(), category.id, description]);
      insertedIds.push(result.rows[0].id);
    }
    const verified = (await client.query(`select count(*)::int valid from products
      where id=any($1::uuid[]) and type='manufactured' and selling_price=0 and stock=0 and avg_cost=0`, [insertedIds])).rows[0].valid;
    assert.equal(verified, insertedIds.length, 'Imported product validation failed');
    assert.deepEqual(await snapshot(), before, 'Accounting or stock history changed; import rolled back');
    await client.query('COMMIT');
    committed = true;
    const catalog = (await client.query(`select count(*)::int products, count(*) filter(where p.type='manufactured')::int manufactured,
      count(*) filter(where selling_price=0 and stock=0)::int zero_price_and_stock
      from products p join categories c on c.id=p.category_id where c.name=$1`, [categoryName])).rows[0];
    console.log('Import committed:', { imported: insertedIds.length, ...catalog });
    console.log('Accounting and stock history unchanged:', before);
  }
} catch (error) {
  if (client && !committed) await client.query('ROLLBACK').catch(() => {});
  console.error(committed ? 'Import committed, but final verification failed.' : 'Import failed; no products were committed.', error.code ?? error.message);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
