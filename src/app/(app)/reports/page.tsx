import ExportButton from '@/components/ExportButton';
import { q, num, type Row } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';

const REPORTS: Record<string, { title: string; sql: string }> = {
  daily_sales: {
    title: 'daily_sales',
    sql: `select sale_date::text date, count(*) invoices, sum(total) total, sum(amount_paid) paid, sum(total-amount_paid) due
          from sales_invoices where status='confirmed' group by 1 order by 1 desc`,
  },
  monthly_sales: {
    title: 'monthly_sales',
    sql: `select to_char(date_trunc('month',sale_date),'YYYY-MM') month, count(*) invoices, sum(total) total, sum(total-cogs) gross_profit
          from sales_invoices where status='confirmed' group by 1 order by 1 desc`,
  },
  annual_sales: {
    title: 'annual_sales',
    sql: `select extract(year from sale_date)::int year, count(*) invoices, sum(total) total, sum(total-cogs) gross_profit
          from sales_invoices where status='confirmed' group by 1 order by 1 desc`,
  },
  purchases: {
    title: 'purchase_report',
    sql: `select pi.invoice_number, pi.purchase_date::text date, s.name supplier, pi.total, pi.amount_paid paid, pi.total-pi.amount_paid due
          from purchase_invoices pi left join suppliers s on s.id=pi.supplier_id where pi.status='confirmed' order by pi.purchase_date desc`,
  },
  production: {
    title: 'production_report',
    sql: `select b.batch_number, p.name product, b.quantity_completed qty, b.material_cost, b.labor_cost, b.total_cost, b.unit_cost, b.start_date::text
          from production_batches b join products p on p.id=b.product_id order by b.start_date desc`,
  },
  material_consumption: {
    title: 'material_consumption',
    sql: `select p.name material, sum(bi.quantity) qty_used, sum(bi.total) cost from production_batch_items bi
          join products p on p.id=bi.material_id group by 1 order by 3 desc`,
  },
  inventory: {
    title: 'inventory_report',
    sql: `select reference, name, type, stock, avg_cost, stock*avg_cost value, min_stock from products order by type, name`,
  },
  profitability: {
    title: 'profitability',
    sql: `select p.name, sum(si.quantity) qty, sum(si.total) revenue, sum(si.quantity*si.unit_cost) cost,
          sum(si.quantity*(si.unit_price-si.unit_cost)) profit
          from sale_items si join products p on p.id=si.product_id
          join sales_invoices s on s.id=si.invoice_id and s.status='confirmed' group by 1 order by 5 desc`,
  },
  customer_debts: {
    title: 'customer_debt_report',
    sql: `select c.name, c.phone, sum(i.total-i.amount_paid) due from sales_invoices i join customers c on c.id=i.customer_id
          where i.status='confirmed' and i.amount_paid < i.total group by 1,2 order by 3 desc`,
  },
  supplier_debts: {
    title: 'supplier_debt_report',
    sql: `select s.name, s.phone, sum(i.total-i.amount_paid) due from purchase_invoices i join suppliers s on s.id=i.supplier_id
          where i.status='confirmed' and i.amount_paid < i.total group by 1,2 order by 3 desc`,
  },
  pl: {
    title: 'profit_loss',
    sql: `select 'Net Sales' line, coalesce(sum(total),0) v from sales_invoices where status='confirmed'
          union all select 'COGS', coalesce(sum(cogs),0) from sales_invoices where status='confirmed'
          union all select 'Expenses', coalesce(sum(amount),0) from expenses`,
  },
  cash_flow: {
    title: 'cash_flow',
    sql: `select tx_date::text date, tx_type, direction, account, amount, note from financial_transactions order by tx_date desc limit 500`,
  },
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const lang = await getLang();
  const sp = await searchParams;
  const rkey = sp.r ?? 'daily_sales';
  const report = REPORTS[rkey] ?? REPORTS.daily_sales;
  const rows = await q<Row>(report.sql);
  const cols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1f3147]">{t('reports', lang)}</h1>
      <div className="flex gap-2 flex-wrap">
        {Object.keys(REPORTS).map(k => (
          <a key={k} href={`?r=${k}`} className={`btn text-xs ${k === rkey ? 'bg-[#1f3147] text-white' : 'border bg-white'}`}>
            {t(REPORTS[k].title, lang)}
          </a>
        ))}
      </div>
      <div className="card p-0 overflow-x-auto">
        <div className="flex justify-between items-center px-4 py-2 border-b">
          <h3 className="font-semibold">{t(report.title, lang)}</h3>
          <ExportButton report={rkey} lang={lang} />
        </div>
        <table className="w-full">
          <thead><tr>{cols.map(c => <th key={c} className="th">{c}</th>)}</tr></thead>
          <tbody>{rows.map((row, i) => (
            <tr key={i}>{cols.map(c => (
              <td key={c} className="td">{typeof row[c] === 'number' || !isNaN(Number(row[c])) && row[c] !== '' && row[c] != null
                ? (/[a-z]/i.test(String(row[c])) ? String(row[c]) : fmtDZD(num(row[c]), lang))
                : String(row[c] ?? '')}</td>))}
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
