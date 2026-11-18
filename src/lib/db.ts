import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

// Embedded Postgres persisted to ./pgdata (swap for Supabase by using same schema.sql)
const DATA_DIR = process.env.PGDATA_DIR || path.join(process.cwd(), 'pgdata');

const g = globalThis as unknown as { __pg?: PGlite; __pgReady?: Promise<void> };

export async function getDb(): Promise<PGlite> {
  if (!g.__pg) {
    g.__pg = new PGlite(DATA_DIR);
    g.__pgReady = (async () => {
      const schema = fs.readFileSync(path.join(process.cwd(), 'src/lib/schema.sql'), 'utf8');
      await g.__pg!.exec(schema);
    })();
  }
  await g.__pgReady;
  return g.__pg;
}

export type Row = Record<string, unknown>;

export async function q<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  const res = await db.query<T>(sql, params as never[]);
  return res.rows;
}

export async function q1<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

// Run a function inside a transaction
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  const db = await getDb();
  await db.exec('BEGIN');
  try {
    const out = await fn();
    await db.exec('COMMIT');
    return out;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
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
