import { NextRequest, NextResponse } from 'next/server';
import { q } from '@/lib/db';

// same report registry as the reports page (keep in sync)
const SQL: Record<string, string> = {
  daily_sales: `select sale_date::text date, count(*) invoices, sum(total) total, sum(amount_paid) paid, sum(total-amount_paid) due from sales_invoices where status='confirmed' group by 1 order by 1 desc`,
  monthly_sales: `select to_char(date_trunc('month',sale_date),'YYYY-MM') month, count(*) invoices, sum(total) total, sum(total-cogs) gross_profit from sales_invoices where status='confirmed' group by 1 order by 1 desc`,
  annual_sales: `select extract(year from sale_date)::int year, count(*) invoices, sum(total) total, sum(total-cogs) gross_profit from sales_invoices where status='confirmed' group by 1 order by 1 desc`,
  purchases: `select pi.invoice_number, pi.purchase_date::text date, s.name supplier, pi.total, pi.amount_paid paid, pi.total-pi.amount_paid due from purchase_invoices pi left join suppliers s on s.id=pi.supplier_id where pi.status='confirmed' order by pi.purchase_date desc`,
  production: `select b.batch_number, p.name product, b.quantity_completed qty, b.material_cost, b.labor_cost, b.total_cost, b.unit_cost, b.start_date::text from production_batches b join products p on p.id=b.product_id order by b.start_date desc`,
  material_consumption: `select p.name material, sum(bi.quantity) qty_used, sum(bi.total) cost from production_batch_items bi join products p on p.id=bi.material_id group by 1 order by 3 desc`,
  inventory: `select reference, name, type, stock, avg_cost, stock*avg_cost value, min_stock from products order by type, name`,
  profitability: `select p.name, sum(si.quantity) qty, sum(si.total) revenue, sum(si.quantity*si.unit_cost) cost, sum(si.quantity*(si.unit_price-si.unit_cost)) profit from sale_items si join products p on p.id=si.product_id join sales_invoices s on s.id=si.invoice_id and s.status='confirmed' group by 1 order by 5 desc`,
  customer_debts: `select c.name, c.phone, sum(i.total-i.amount_paid) due from sales_invoices i join customers c on c.id=i.customer_id where i.status='confirmed' and i.amount_paid < i.total group by 1,2 order by 3 desc`,
  supplier_debts: `select s.name, s.phone, sum(i.total-i.amount_paid) due from purchase_invoices i join suppliers s on s.id=i.supplier_id where i.status='confirmed' and i.amount_paid < i.total group by 1,2 order by 3 desc`,
  pl: `select 'Net Sales' line, coalesce(sum(total),0) v from sales_invoices where status='confirmed' union all select 'COGS', coalesce(sum(cogs),0) from sales_invoices where status='confirmed' union all select 'Expenses', coalesce(sum(amount),0) from expenses`,
  cash_flow: `select tx_date::text date, tx_type, direction, account, amount, note from financial_transactions order by tx_date desc limit 500`,
};

export async function GET(req: NextRequest) {
  const r = req.nextUrl.searchParams.get('r') ?? 'daily_sales';
  const sql = SQL[r];
  if (!sql) return new NextResponse('unknown report', { status: 400 });
  const rows = await q(sql);
  const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = rows.length
    ? [Object.keys(rows[0]).map(esc).join(','), ...rows.map(row => Object.values(row).map(esc).join(','))].join('\n')
    : '';
  return new NextResponse('﻿' + csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${r}.csv"`,
    },
  });
}
