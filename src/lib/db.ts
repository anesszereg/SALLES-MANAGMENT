import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';

// PostgreSQL connection pool; DATABASE_URL points to Neon or another PostgreSQL host.
const g = globalThis as unknown as { __neonPool?: Pool };
const transactionClient = new AsyncLocalStorage<PoolClient>();

export async function getDb(): Promise<Pool> {
  if (!g.__neonPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('sslmode', 'verify-full');
    const config = {
      connectionString: url.toString(),
      enableChannelBinding: true,
      max: 12,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 600000,
      allowExitOnIdle: true,
      options: '-c timezone=Africa/Algiers',
    };
    g.__neonPool = new Pool(config);
    g.__neonPool.on('error', () => console.error('An idle PostgreSQL connection failed'));
  }
  return g.__neonPool;
}

export type Row = Record<string, unknown>;

export async function q<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = transactionClient.getStore() ?? await getDb();
  const res = await db.query(sql, params);
  return res.rows as T[];
}

export async function q1<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

// Run a function inside a transaction
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (transactionClient.getStore()) return fn();
  const client = await (await getDb()).connect();
  try {
    await client.query('BEGIN');
    const out = await transactionClient.run(client, fn);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export const num = (v: unknown): number => (v == null ? 0 : Number(v));

// Atomic document number, e.g. SAL-0001
export async function nextDocNumber(prefix: string): Promise<string> {
  const row = await q1<{ next_number: number }>(
    `update document_sequences set next_number = next_number + 1 where prefix=$1 returning next_number - 1 as next_number`,
    [prefix]
  );
  return `${prefix}-${String(row?.next_number ?? 1).padStart(4, '0')}`;
}

// Apply a signed stock change; updates stock + weighted average cost; records movement.
// Must be called inside tx() for multi-step operations.
export async function applyStockMovement(opts: {
  productId: string;
  movementType: string;
  quantity: number; // signed
  unitCost?: number;
  refType?: string;
  refId?: string;
  note?: string;
}): Promise<void> {
  const { productId, movementType, quantity, unitCost = 0, refType, refId, note } = opts;
  const p = await q1<{ stock: number; avg_cost: number }>(
    'select stock, avg_cost from products where id=$1 for update', [productId]);
  if (!p) throw new Error('Product not found');
  const curStock = num(p.stock), curCost = num(p.avg_cost);
  let newCost = curCost;
  if (quantity > 0) {
    // weighted average cost on incoming stock
    newCost = curStock + quantity > 0
      ? (curStock * curCost + quantity * unitCost) / (curStock + quantity)
      : unitCost;
  }
  const newStock = curStock + quantity;
  await q('update products set stock=$1, avg_cost=$2 where id=$3', [newStock, newCost, productId]);
  await q(
    `insert into stock_movements(product_id,movement_type,quantity,unit_cost,reference_type,reference_id,note)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [productId, movementType, quantity, unitCost, refType ?? null, refId ?? null, note ?? null]
  );
}

export async function recordCashTx(opts: {
  type: string; direction: 'in' | 'out'; amount: number;
  refType?: string; refId?: string; note?: string; date?: string; account?: string;
}): Promise<void> {
  await q(
    `insert into financial_transactions(tx_type,direction,amount,account,reference_type,reference_id,tx_date,note)
     values ($1,$2,$3,$4,$5,$6,coalesce($7::date,current_date),$8)`,
    [opts.type, opts.direction, opts.amount, opts.account ?? 'cash',
     opts.refType ?? null, opts.refId ?? null, opts.date ?? null, opts.note ?? null]
  );
}
