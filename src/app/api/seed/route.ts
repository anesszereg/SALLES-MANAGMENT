import { NextResponse } from 'next/server';
import { q, q1, num, applyStockMovement, recordCashTx, tx } from '@/lib/db';
import { isAuthed } from '@/lib/helpers';

// One-shot demo seed — inserts sample data only if DB is empty
export async function POST() {
  if (process.env.DATABASE_URL) return new NextResponse('Demo seeding is disabled for the hosted database', { status: 403 });
  if (!(await isAuthed())) return new NextResponse('unauthorized', { status: 401 });
  const existing = await q1('select id from products limit 1');
  if (existing) return NextResponse.json({ ok: false, msg: 'already seeded' });

  await tx(async () => {
    const cat = (await q1<{ id: string }>(`insert into categories(name) values('Furniture') returning id`))!.id;
    const mk = async (ref: string, name: string, type: string, price = 0) =>
      (await q1<{ id: string }>(`insert into products(reference,name,category_id,type,selling_price) values($1,$2,$3,$4,$5) returning id`, [ref, name, cat, type, price]))!.id;
    const mdf = await mk('MAT-MDF', 'MDF Board 18mm', 'raw_material');
    const hinge = await mk('MAT-HNG', 'Hinge', 'raw_material');
    const mirror = await mk('MAT-MIR', 'Mirror 40x60', 'raw_material');
    const cabinet = await mk('FUR-CAB-A', 'Bathroom Cabinet A', 'manufactured', 18000);
    const chair = await mk('ACC-CHR', 'Plastic Chair', 'resale', 3500);

    const supplier = (await q1<{ id: string }>(`insert into suppliers(name,phone) values('Sarl Bois Nord','0550000001') returning id`))!.id;
    const customer = (await q1<{ id: string }>(`insert into customers(name,phone) values('Hotel El Bahia','0660000002') returning id`))!.id;

    // purchase
    const pinv = (await q1<{ id: string }>(
      `insert into purchase_invoices(invoice_number,supplier_id,category,subtotal,total,amount_paid,payment_method) values('PUR-0001',$1,'raw_materials',61500,61500,30000,'cash') returning id`, [supplier]))!.id;
    for (const [pid, qty2, price] of [[mdf, 20, 2000], [hinge, 100, 50], [mirror, 10, 1500], [chair, 5, 3000]] as const) {
      await q('insert into purchase_items(invoice_id,product_id,quantity,unit_price,total) values($1,$2,$3,$4,$5)', [pinv, pid, qty2, price, qty2 * price]);
      await applyStockMovement({ productId: pid, movementType: 'purchase_in', quantity: qty2, unitCost: price, refType: 'purchase_invoice', refId: pinv });
    }
    await q(`insert into supplier_payments(supplier_id,invoice_id,amount,payment_method) values($1,$2,30000,'cash')`, [supplier, pinv]);
    await recordCashTx({ type: 'supplier_payment', direction: 'out', amount: 30000, refType: 'purchase_invoice', refId: pinv });

    // recipe + production
    const recipe = (await q1<{ id: string }>(`insert into production_recipes(product_id,name) values($1,'Cabinet A standard') returning id`, [cabinet]))!.id;
    await q(`insert into production_recipe_items(recipe_id,material_id,quantity) values ($1,$2,2),($1,$3,4),($1,$4,1)`, [recipe, mdf, hinge, mirror]);
    const matCost = 2 * 2000 + 4 * 50 + 1500;
    const totalCost = matCost + 3000 + 500;
    const batch = (await q1<{ id: string }>(
      `insert into production_batches(batch_number,product_id,recipe_id,quantity_planned,quantity_completed,material_cost,labor_cost,transport_cost,total_cost,unit_cost,status,completion_date)
       values('PRD-0001',$1,$2,1,1,$3,3000,500,$4,$4,'completed',current_date) returning id`, [cabinet, recipe, matCost, totalCost]))!.id;
    await q(`insert into production_batch_items(batch_id,material_id,quantity,unit_cost,total) values ($1,$2,2,2000,4000),($1,$3,4,50,200),($1,$4,1,1500,1500)`, [batch, mdf, hinge, mirror]);
    await applyStockMovement({ productId: mdf, movementType: 'production_out', quantity: -2, unitCost: 2000, refType: 'production_batch', refId: batch });
    await applyStockMovement({ productId: hinge, movementType: 'production_out', quantity: -4, unitCost: 50, refType: 'production_batch', refId: batch });
    await applyStockMovement({ productId: mirror, movementType: 'production_out', quantity: -1, unitCost: 1500, refType: 'production_batch', refId: batch });
    await applyStockMovement({ productId: cabinet, movementType: 'production_in', quantity: 1, unitCost: totalCost, refType: 'production_batch', refId: batch });

    // sale
    const cabCost = num((await q1<{ avg_cost: number }>('select avg_cost from products where id=$1', [cabinet]))!.avg_cost);
    const chrCost = num((await q1<{ avg_cost: number }>('select avg_cost from products where id=$1', [chair]))!.avg_cost);
    const cogs = cabCost + 2 * chrCost;
    const sinv = (await q1<{ id: string }>(
      `insert into sales_invoices(invoice_number,customer_id,subtotal,discount,total,amount_paid,cogs,payment_method)
       values('SAL-0001',$1,25000,500,24500,15000,$2,'cash') returning id`, [customer, cogs]))!.id;
    await q(`insert into sale_items(invoice_id,product_id,quantity,unit_price,unit_cost,total) values ($1,$2,1,18000,$3,18000),($1,$4,2,3500,$5,7000)`, [sinv, cabinet, cabCost, chair, chrCost]);
    await q(`insert into customer_payments(customer_id,invoice_id,amount,payment_method) values($1,$2,15000,'cash')`, [customer, sinv]);
    await recordCashTx({ type: 'customer_payment', direction: 'in', amount: 15000, refType: 'sales_invoice', refId: sinv });
    await applyStockMovement({ productId: cabinet, movementType: 'sale_out', quantity: -1, unitCost: cabCost, refType: 'sales_invoice', refId: sinv });
    await applyStockMovement({ productId: chair, movementType: 'sale_out', quantity: -2, unitCost: chrCost, refType: 'sales_invoice', refId: sinv });

    // expense
    const ec = (await q1<{ id: string }>(`select id from expense_categories where name='Rent'`))!.id;
    const exp = (await q1<{ id: string }>(`insert into expenses(category_id,amount,description,payment_method) values($1,40000,'Monthly rent','cash') returning id`, [ec]))!.id;
    await recordCashTx({ type: 'expense', direction: 'out', amount: 40000, refType: 'expense', refId: exp });

    await q(`insert into business_settings(key,value) values('business_name','Lune Benif Meubles') on conflict do nothing`);
  });
  return NextResponse.json({ ok: true });
}
