// Seed sample data: node scripts/seed.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

const db = new PGlite(path.join(process.cwd(), 'pgdata'));
await db.exec(fs.readFileSync('src/lib/schema.sql', 'utf8'));

const q = (s, p = []) => db.query(s, p);
const one = async (s, p) => (await q(s, p)).rows[0];

// category + products
const cat = (await one(`insert into categories(name) values('Furniture') returning id`)).id;
const mdf = (await one(`insert into products(reference,name,category_id,type,selling_price) values('MAT-MDF','MDF Board 18mm',$1,'raw_material',0) returning id`, [cat])).id;
const hinge = (await one(`insert into products(reference,name,category_id,type,selling_price) values('MAT-HNG','Hinge',$1,'raw_material',0) returning id`, [cat])).id;
const mirror = (await one(`insert into products(reference,name,category_id,type,selling_price) values('MAT-MIR','Mirror 40x60',$1,'raw_material',0) returning id`, [cat])).id;
const cabinet = (await one(`insert into products(reference,name,category_id,type,selling_price) values('FUR-CAB-A','Bathroom Cabinet A',$1,'manufactured',18000) returning id`, [cat])).id;
const chair = (await one(`insert into products(reference,name,category_id,type,selling_price) values('ACC-CHR','Plastic Chair',$1,'resale',3500) returning id`, [cat])).id;

const supplier = (await one(`insert into suppliers(name,phone) values('Sarl Bois Nord','0550000001') returning id`)).id;
const customer = (await one(`insert into customers(name,phone) values('Hotel El Bahia','0660000002') returning id`)).id;

// purchase materials + chairs
const mv = async (pid, type, qty, cost, rt, rid) => {
  const p = await one('select stock,avg_cost from products where id=$1 for update', [pid]);
  const ns = Number(p.stock) + qty;
  const nc = qty > 0 && ns > 0 ? (Number(p.stock) * Number(p.avg_cost) + qty * cost) / ns : Number(p.avg_cost);
  await q('update products set stock=$1,avg_cost=$2 where id=$3', [ns, nc, pid]);
  await q('insert into stock_movements(product_id,movement_type,quantity,unit_cost,reference_type,reference_id) values($1,$2,$3,$4,$5,$6)', [pid, type, qty, cost, rt, rid]);
};

const pinv = (await one(`insert into purchase_invoices(invoice_number,supplier_id,subtotal,total,amount_paid,payment_method) values('PUR-0001',$1,61500,61500,30000,'cash') returning id`, [supplier])).id;
await q(`insert into purchase_items(invoice_id,product_id,quantity,unit_price,total) values
  ($1,$2,20,2000,40000),($1,$3,100,50,5000),($1,$4,10,1500,15000),($1,$5,5,3000,15000)`, [pinv, mdf, hinge, mirror, chair]);
await q(`insert into supplier_payments(supplier_id,invoice_id,amount,payment_method) values($1,$2,30000,'cash')`, [supplier, pinv]);
await q(`insert into financial_transactions(tx_type,direction,amount,reference_type,reference_id) values('supplier_payment','out',30000,'purchase_invoice',$1)`, [pinv]);
await mv(mdf, 'purchase_in', 20, 2000, 'purchase_invoice', pinv);
await mv(hinge, 'purchase_in', 100, 50, 'purchase_invoice', pinv);
await mv(mirror, 'purchase_in', 10, 1500, 'purchase_invoice', pinv);
await mv(chair, 'purchase_in', 5, 3000, 'purchase_invoice', pinv);

// recipe + production batch: cabinet = 2 MDF + 4 hinges + 1 mirror, labor 3000, transport 500
const recipe = (await one(`insert into production_recipes(product_id,name) values($1,'Cabinet A standard') returning id`, [cabinet])).id;
await q(`insert into production_recipe_items(recipe_id,material_id,quantity) values ($1,$2,2),($1,$3,4),($1,$4,1)`, [recipe, mdf, hinge, mirror]);
const matCost = 2 * 2000 + 4 * 50 + 1500; // 5700
const batchCost = matCost + 3000 + 500; // 9200 for 2 units? use 1 unit for simplicity
const batch = (await one(`insert into production_batches(batch_number,product_id,recipe_id,quantity_planned,quantity_completed,material_cost,labor_cost,transport_cost,total_cost,unit_cost,status,completion_date)
  values('PRD-0001',$1,$2,1,1,$3,3000,500,$4,$4,'completed',current_date) returning id`, [cabinet, recipe, matCost, batchCost])).id;
await q(`insert into production_batch_items(batch_id,material_id,quantity,unit_cost,total) values ($1,$2,2,2000,4000),($1,$3,4,50,200),($1,$4,1,1500,1500)`, [batch, mdf, hinge, mirror]);
await mv(mdf, 'production_out', -2, 2000, 'production_batch', batch);
await mv(hinge, 'production_out', -4, 50, 'production_batch', batch);
await mv(mirror, 'production_out', -1, 1500, 'production_batch', batch);
await mv(cabinet, 'production_in', 1, batchCost, 'production_batch', batch);

// sale: 1 cabinet @18000 + 2 chairs @3500, paid 15000
const cabCost = (await one('select avg_cost from products where id=$1', [cabinet])).avg_cost;
const chrCost = (await one('select avg_cost from products where id=$1', [chair])).avg_cost;
const cogs = Number(cabCost) + 2 * Number(chrCost);
const sinv = (await one(`insert into sales_invoices(invoice_number,customer_id,subtotal,discount,total,amount_paid,cogs,payment_method)
  values('SAL-0001',$1,25000,500,24500,15000,$2,'cash') returning id`, [customer, cogs])).id;
await q(`insert into sale_items(invoice_id,product_id,quantity,unit_price,unit_cost,total) values ($1,$2,1,18000,$3,18000),($1,$4,2,3500,$5,7000)`, [sinv, cabinet, cabCost, chair, chrCost]);
await q(`insert into customer_payments(customer_id,invoice_id,amount,payment_method) values($1,$2,15000,'cash')`, [customer, sinv]);
await q(`insert into financial_transactions(tx_type,direction,amount,reference_type,reference_id) values('customer_payment','in',15000,'sales_invoice',$1)`, [sinv]);
await mv(cabinet, 'sale_out', -1, Number(cabCost), 'sales_invoice', sinv);
await mv(chair, 'sale_out', -2, Number(chrCost), 'sales_invoice', sinv);

// expense
const ec = (await one(`select id from expense_categories where name='Rent'`)).id;
const exp = (await one(`insert into expenses(category_id,amount,description,payment_method) values($1,40000,'Monthly rent','cash') returning id`, [ec])).id;
await q(`insert into financial_transactions(tx_type,direction,amount,reference_type,reference_id) values('expense','out',40000,'expense',$1)`, [exp]);

await q(`insert into business_settings(key,value) values('business_name','Lune Benif Meubles') on conflict do nothing`);
console.log('Seeded: purchase PUR-0001, batch PRD-0001, sale SAL-0001, rent expense.');
await db.close();
