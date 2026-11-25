'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q, q1, tx, num, nextDocNumber, applyStockMovement, recordCashTx } from './db';
import { isAuthed } from './helpers';

async function guard() {
  if (!(await isAuthed())) throw new Error('Unauthorized');
}
const rev = () => revalidatePath('/', 'layout');

// ---------- AUTH ----------
export async function loginAction(_prev: unknown, fd: FormData) {
  const pw = String(fd.get('password') ?? '');
  if (pw === (process.env.ADMIN_PASSWORD || 'admin123')) {
    (await cookies()).set('session', 'ok', { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30 });
    (await cookies()).set('erp-flash', 'login', { path: '/', maxAge: 60, sameSite: 'lax' });
    redirect('/');
  }
  return { error: 'Invalid password' };
}

export async function logoutAction() {
  (await cookies()).delete('session');
  (await cookies()).set('erp-flash', 'logout', { path: '/', maxAge: 60, sameSite: 'lax' });
  redirect('/login');
}

export async function setLangAction(lang: string) {
  (await cookies()).set('lang', lang, { path: '/' });
  rev();
}

// ---------- SETTINGS ----------
export async function saveSettings(fd: FormData) {
  await guard();
  for (const k of ['business_name', 'phone', 'address', 'logo_url']) {
    const v = String(fd.get(k) ?? '');
    await q('insert into business_settings(key,value) values($1,$2) on conflict(key) do update set value=$2', [k, v]);
  }
  rev();
}

export async function getSetting(key: string): Promise<string> {
  const r = await q1<{ value: string }>('select value from business_settings where key=$1', [key]);
  return r?.value ?? '';
}

// ---------- CATEGORIES / PRODUCTS ----------
export async function addCategory(fd: FormData) {
  await guard();
  await q('insert into categories(name) values($1)', [String(fd.get('name'))]);
  rev();
}

export async function saveProduct(fd: FormData) {
  await guard();
  const id = String(fd.get('id') ?? '');
  const vals = [
    String(fd.get('reference')), String(fd.get('name')), fd.get('category_id') || null,
    String(fd.get('type')), String(fd.get('description') ?? ''), String(fd.get('image_url') ?? ''),
    num(fd.get('selling_price')), num(fd.get('min_stock')), num(fd.get('avg_cost')),
  ];
  if (id) {
    await q(`update products set reference=$1,name=$2,category_id=$3,type=$4,description=$5,image_url=$6,selling_price=$7,min_stock=$8,avg_cost=$9 where id=$10`, [...vals, id]);
  } else {
    await q(`insert into products(reference,name,category_id,type,description,image_url,selling_price,min_stock,avg_cost) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, vals);
  }
  rev();
}

export async function deleteProduct(id: string) {
  await guard();
  const used = await q1('select 1 from stock_movements where product_id=$1 limit 1', [id]);
  if (used) throw new Error('Product has stock movements; cannot delete');
  await q('delete from products where id=$1', [id]);
  rev();
}

// ---------- SUPPLIERS / CUSTOMERS ----------
export async function saveSupplier(fd: FormData) {
  await guard();
  const id = String(fd.get('id') ?? '');
  const vals = [String(fd.get('name')), String(fd.get('phone') ?? ''), String(fd.get('address') ?? ''), String(fd.get('notes') ?? '')];
  if (id) await q('update suppliers set name=$1,phone=$2,address=$3,notes=$4 where id=$5', [...vals, id]);
  else await q('insert into suppliers(name,phone,address,notes) values($1,$2,$3,$4)', vals);
  rev();
}

export async function saveCustomer(fd: FormData) {
  await guard();
  const id = String(fd.get('id') ?? '');
  const vals = [String(fd.get('name')), String(fd.get('phone') ?? ''), String(fd.get('address') ?? ''), String(fd.get('notes') ?? '')];
  if (id) await q('update customers set name=$1,phone=$2,address=$3,notes=$4 where id=$5', [...vals, id]);
  else await q('insert into customers(name,phone,address,notes) values($1,$2,$3,$4)', vals);
  rev();
}

// ---------- PURCHASES ----------
export async function createPurchase(fd: FormData) {
  await guard();
  const items = JSON.parse(String(fd.get('items') ?? '[]')) as { product_id: string; quantity: number; unit_price: number }[];
  if (!items.length) throw new Error('No items');
  const extra = num(fd.get('extra_costs'));
  const paid = num(fd.get('amount_paid'));
  const supplierId = String(fd.get('supplier_id') ?? '') || null;
  const method = String(fd.get('payment_method') ?? 'cash');
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = subtotal + extra;

  await tx(async () => {
    const inv = await nextDocNumber('PUR');
    const r = await q1<{ id: string }>(
      `insert into purchase_invoices(invoice_number,supplier_id,purchase_date,category,subtotal,extra_costs,total,amount_paid,payment_method,notes)
       values($1,$2,coalesce($3::date,current_date),$4,$5,$6,$7,$8,$9,$10) returning id`,
      [inv, supplierId, String(fd.get('purchase_date') ?? ''), String(fd.get('category') ?? 'raw_materials'),
       subtotal, extra, total, paid, method, String(fd.get('notes') ?? '')]
    );
    const invId = r!.id;
    // spread extra costs proportionally over items for true landed cost
    for (const it of items) {
      const lineTotal = it.quantity * it.unit_price;
      const share = subtotal > 0 ? (lineTotal / subtotal) * extra : 0;
      const landedUnit = (lineTotal + share) / it.quantity;
      await q('insert into purchase_items(invoice_id,product_id,quantity,unit_price,total) values($1,$2,$3,$4,$5)',
        [invId, it.product_id, it.quantity, it.unit_price, lineTotal]);
      await applyStockMovement({ productId: it.product_id, movementType: 'purchase_in', quantity: it.quantity, unitCost: landedUnit, refType: 'purchase_invoice', refId: invId });
    }
    if (paid > 0) {
      await q('insert into supplier_payments(supplier_id,invoice_id,amount,payment_method,payment_date) values($1,$2,$3,$4,current_date)',
        [supplierId, invId, paid, method]);
      await recordCashTx({ type: 'supplier_payment', direction: 'out', amount: paid, refType: 'purchase_invoice', refId: invId, account: method === 'bank' ? 'bank' : 'cash' });
    }
    await q('insert into audit_logs(action,entity,entity_id,detail) values($1,$2,$3,$4)', ['create', 'purchase_invoice', invId, inv]);
  });
  rev();
}

export async function addSupplierPayment(fd: FormData) {
  await guard();
  const amount = num(fd.get('amount'));
  const method = String(fd.get('payment_method') ?? 'cash');
  const invoiceId = String(fd.get('invoice_id') ?? '') || null;
  const supplierId = String(fd.get('supplier_id'));
  await tx(async () => {
    await q('insert into supplier_payments(supplier_id,invoice_id,amount,payment_method,payment_date,notes) values($1,$2,$3,$4,coalesce($5::date,current_date),$6)',
      [supplierId, invoiceId, amount, method, String(fd.get('payment_date') ?? ''), String(fd.get('notes') ?? '')]);
    if (invoiceId) {
      await q('update purchase_invoices set amount_paid = least(total, amount_paid + $1) where id=$2', [amount, invoiceId]);
    } else {
      // allocate to oldest unpaid invoices
      let left = amount;
      const unpaid = await q<{ id: string; due: number }>(
        `select id, total - amount_paid as due from purchase_invoices where supplier_id=$1 and status='confirmed' and amount_paid < total order by purchase_date`, [supplierId]);
      for (const u of unpaid) {
        if (left <= 0) break;
        const pay = Math.min(left, num(u.due));
        await q('update purchase_invoices set amount_paid=amount_paid+$1 where id=$2', [pay, u.id]);
        left -= pay;
      }
    }
    await recordCashTx({ type: 'supplier_payment', direction: 'out', amount, refType: 'supplier_payment', refId: invoiceId ?? undefined, account: method === 'bank' ? 'bank' : 'cash' });
  });
  rev();
}

// ---------- SALES ----------
export async function createSale(fd: FormData) {
  await guard();
  const items = JSON.parse(String(fd.get('items') ?? '[]')) as { product_id: string; quantity: number; unit_price: number }[];
  if (!items.length) throw new Error('No items');
  const discount = num(fd.get('discount'));
  const paid = num(fd.get('amount_paid'));
  const customerId = String(fd.get('customer_id') ?? '') || null;
  const method = String(fd.get('payment_method') ?? 'cash');
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = subtotal - discount;

  await tx(async () => {
    const inv = await nextDocNumber('SAL');
    let cogs = 0;
    const lines = items.map(it => ({ ...it, cost: 0 }));
    for (const l of lines) {
      const p = await q1<{ avg_cost: number }>('select avg_cost from products where id=$1', [l.product_id]);
      l.cost = num(p?.avg_cost);
      cogs += l.cost * l.quantity;
    }
    const r = await q1<{ id: string }>(
      `insert into sales_invoices(invoice_number,customer_id,sale_date,subtotal,discount,total,amount_paid,cogs,payment_method,notes)
       values($1,$2,coalesce($3::date,current_date),$4,$5,$6,$7,$8,$9,$10) returning id`,
      [inv, customerId, String(fd.get('sale_date') ?? ''), subtotal, discount, total, paid, cogs, method, String(fd.get('notes') ?? '')]
    );
    const invId = r!.id;
    for (const l of lines) {
      await q('insert into sale_items(invoice_id,product_id,quantity,unit_price,unit_cost,total) values($1,$2,$3,$4,$5,$6)',
        [invId, l.product_id, l.quantity, l.unit_price, l.cost, l.quantity * l.unit_price]);
      await applyStockMovement({ productId: l.product_id, movementType: 'sale_out', quantity: -l.quantity, unitCost: l.cost, refType: 'sales_invoice', refId: invId });
    }
    if (paid > 0) {
      await q('insert into customer_payments(customer_id,invoice_id,amount,payment_method,payment_date) values($1,$2,$3,$4,current_date)',
        [customerId, invId, paid, method]);
      await recordCashTx({ type: 'customer_payment', direction: 'in', amount: paid, refType: 'sales_invoice', refId: invId, account: method === 'bank' ? 'bank' : 'cash' });
    }
    await q('insert into audit_logs(action,entity,entity_id,detail) values($1,$2,$3,$4)', ['create', 'sales_invoice', invId, inv]);
  });
  rev();
}

export async function addCustomerPayment(fd: FormData) {
  await guard();
  const amount = num(fd.get('amount'));
  const method = String(fd.get('payment_method') ?? 'cash');
  const invoiceId = String(fd.get('invoice_id') ?? '') || null;
  const customerId = String(fd.get('customer_id'));
  await tx(async () => {
    await q('insert into customer_payments(customer_id,invoice_id,amount,payment_method,payment_date,notes) values($1,$2,$3,$4,coalesce($5::date,current_date),$6)',
      [customerId, invoiceId, amount, method, String(fd.get('payment_date') ?? ''), String(fd.get('notes') ?? '')]);
    if (invoiceId) {
      await q('update sales_invoices set amount_paid = least(total, amount_paid + $1) where id=$2', [amount, invoiceId]);
    } else {
      let left = amount;
      const unpaid = await q<{ id: string; due: number }>(
        `select id, total - amount_paid as due from sales_invoices where customer_id=$1 and status='confirmed' and amount_paid < total order by sale_date`, [customerId]);
      for (const u of unpaid) {
        if (left <= 0) break;
        const pay = Math.min(left, num(u.due));
        await q('update sales_invoices set amount_paid=amount_paid+$1 where id=$2', [pay, u.id]);
        left -= pay;
      }
    }
    await recordCashTx({ type: 'customer_payment', direction: 'in', amount, account: method === 'bank' ? 'bank' : 'cash' });
  });
  rev();
}

export async function getSaleItems(invoiceId: string) {
  await guard();
  return q('select si.product_id, si.quantity, si.unit_price, si.unit_cost, p.name from sale_items si join products p on p.id=si.product_id where si.invoice_id=$1', [invoiceId]);
}

export async function cancelSale(invoiceId: string) {
  await guard();
  await tx(async () => {
    const inv = await q1<{ status: string; amount_paid: number }>('select status, amount_paid from sales_invoices where id=$1 for update', [invoiceId]);
    if (!inv || inv.status !== 'confirmed') return;
    const items = await q<{ product_id: string; quantity: number; unit_cost: number }>('select product_id,quantity,unit_cost from sale_items where invoice_id=$1', [invoiceId]);
    for (const it of items) {
      await applyStockMovement({ productId: it.product_id, movementType: 'return_in', quantity: num(it.quantity), unitCost: num(it.unit_cost), refType: 'sales_invoice_cancel', refId: invoiceId });
    }
    const paidBack = num(inv.amount_paid);
    if (paidBack > 0) await recordCashTx({ type: 'customer_refund', direction: 'out', amount: paidBack, refType: 'sales_invoice', refId: invoiceId });
    await q("update sales_invoices set status='cancelled' where id=$1", [invoiceId]);
  });
  rev();
}

export async function createSalesReturn(fd: FormData) {
  await guard();
  const invoiceId = String(fd.get('invoice_id'));
  const items = JSON.parse(String(fd.get('items') ?? '[]')) as { product_id: string; quantity: number; unit_price: number; unit_cost: number }[];
  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const cogs = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  await tx(async () => {
    const rn = await nextDocNumber('RET');
    const r = await q1<{ id: string }>(
      'insert into sales_returns(return_number,sales_invoice_id,total,cogs,reason) values($1,$2,$3,$4,$5) returning id',
      [rn, invoiceId, total, cogs, String(fd.get('reason') ?? '')]);
    for (const it of items) {
      await q('insert into sales_return_items(return_id,product_id,quantity,unit_price,unit_cost) values($1,$2,$3,$4,$5)',
        [r!.id, it.product_id, it.quantity, it.unit_price, it.unit_cost]);
      await applyStockMovement({ productId: it.product_id, movementType: 'return_in', quantity: it.quantity, unitCost: it.unit_cost, refType: 'sales_return', refId: r!.id });
    }
    // reduce invoice total and receivable proportionally
    await q('update sales_invoices set total=greatest(amount_paid,total-$1), cogs=greatest(0,cogs-$2) where id=$3', [total, cogs, invoiceId]);
  });
  rev();
}

// ---------- PRODUCTION ----------
export async function saveRecipe(fd: FormData) {
  await guard();
  const items = JSON.parse(String(fd.get('items') ?? '[]')) as { material_id: string; quantity: number }[];
  const id = String(fd.get('id') ?? '');
  await tx(async () => {
    let rid = id;
    if (id) {
      await q('update production_recipes set name=$1, product_id=$2, notes=$3 where id=$4',
        [String(fd.get('name')), String(fd.get('product_id')), String(fd.get('notes') ?? ''), id]);
      await q('delete from production_recipe_items where recipe_id=$1', [id]);
    } else {
      const r = await q1<{ id: string }>('insert into production_recipes(product_id,name,notes) values($1,$2,$3) returning id',
        [String(fd.get('product_id')), String(fd.get('name')), String(fd.get('notes') ?? '')]);
      rid = r!.id;
    }
    for (const it of items) {
      await q('insert into production_recipe_items(recipe_id,material_id,quantity) values($1,$2,$3)', [rid, it.material_id, it.quantity]);
    }
  });
  rev();
}

export async function createBatch(fd: FormData) {
  await guard();
  const items = JSON.parse(String(fd.get('items') ?? '[]')) as { material_id: string; quantity: number }[];
  const productId = String(fd.get('product_id'));
  const qty = num(fd.get('quantity'));
  const labor = num(fd.get('labor_cost')), transport = num(fd.get('transport_cost')), other = num(fd.get('other_cost'));
  await tx(async () => {
    const bn = await nextDocNumber('PRD');
    let matCost = 0;
    const costs: { id: string; qty: number; cost: number }[] = [];
    for (const it of items) {
      const p = await q1<{ avg_cost: number; stock: number; name: string }>('select avg_cost,stock,name from products where id=$1 for update', [it.material_id]);
      if (!p || num(p.stock) < it.quantity) throw new Error(`Insufficient material: ${p?.name ?? it.material_id}`);
      matCost += num(p.avg_cost) * it.quantity;
      costs.push({ id: it.material_id, qty: it.quantity, cost: num(p.avg_cost) });
    }
    const totalCost = matCost + labor + transport + other;
    const r = await q1<{ id: string }>(
      `insert into production_batches(batch_number,product_id,recipe_id,quantity_planned,material_cost,labor_cost,transport_cost,other_cost,total_cost,unit_cost,status,start_date,notes)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed',$11::date,$12) returning id`,
      [bn, productId, String(fd.get('recipe_id') ?? '') || null, qty, matCost, labor, transport, other, totalCost,
       qty > 0 ? totalCost / qty : 0, String(fd.get('start_date') ?? '') || new Date().toISOString().slice(0, 10), String(fd.get('notes') ?? '')]
    );
    const bid = r!.id;
    for (const c of costs) {
      await q('insert into production_batch_items(batch_id,material_id,quantity,unit_cost,total) values($1,$2,$3,$4,$5)',
        [bid, c.id, c.qty, c.cost, c.qty * c.cost]);
      await applyStockMovement({ productId: c.id, movementType: 'production_out', quantity: -c.qty, unitCost: c.cost, refType: 'production_batch', refId: bid });
    }
    await applyStockMovement({ productId, movementType: 'production_in', quantity: qty, unitCost: qty > 0 ? totalCost / qty : 0, refType: 'production_batch', refId: bid });
    await q('update production_batches set quantity_completed=$1, completion_date=current_date where id=$2', [qty, bid]);
    await q('insert into audit_logs(action,entity,entity_id,detail) values($1,$2,$3,$4)', ['complete', 'production_batch', bid, bn]);
  });
  rev();
}

export async function getRecipeItems(recipeId: string) {
  await guard();
  return q('select material_id, quantity from production_recipe_items where recipe_id=$1', [recipeId]);
}

// ---------- INVENTORY ----------
export async function stockAdjustment(fd: FormData) {
  await guard();
  const productId = String(fd.get('product_id'));
  const qty = num(fd.get('quantity')); // signed
  const reason = String(fd.get('reason') ?? 'correction');
  await tx(async () => {
    await q('insert into inventory_adjustments(product_id,quantity,reason,note) values($1,$2,$3,$4)',
      [productId, qty, reason, String(fd.get('note') ?? '')]);
    const p = await q1<{ avg_cost: number }>('select avg_cost from products where id=$1', [productId]);
    await applyStockMovement({
      productId, movementType: reason === 'damaged' ? 'damaged' : 'adjustment', quantity: qty,
      unitCost: qty > 0 ? num(p?.avg_cost) : num(p?.avg_cost), note: reason,
    });
  });
  rev();
}

// ---------- EXPENSES ----------
export async function saveExpense(fd: FormData) {
  await guard();
  const amount = num(fd.get('amount'));
  const method = String(fd.get('payment_method') ?? 'cash');
  await tx(async () => {
    const r = await q1<{ id: string }>(
      `insert into expenses(expense_date,category_id,amount,description,payment_method) values(coalesce($1::date,current_date),$2,$3,$4,$5) returning id`,
      [String(fd.get('expense_date') ?? ''), fd.get('category_id') || null, amount, String(fd.get('description') ?? ''), method]);
    await recordCashTx({ type: 'expense', direction: 'out', amount, refType: 'expense', refId: r!.id, account: method === 'bank' ? 'bank' : 'cash' });
  });
  rev();
}

export async function deleteExpense(id: string) {
  await guard();
  await tx(async () => {
    const e = await q1<{ amount: number }>('select amount from expenses where id=$1', [id]);
    await q('delete from expenses where id=$1', [id]);
    await q("delete from financial_transactions where reference_type='expense' and reference_id=$1", [id]);
    void e;
  });
  rev();
}
