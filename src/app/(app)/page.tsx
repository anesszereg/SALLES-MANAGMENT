import { q, q1, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import { Bars, Lines, PieC } from '@/components/Charts';
import DateFilter from '@/components/DateFilter';

function range(p?: string, from?: string, to?: string): [string, string] {
  const d = new Date(); const iso = (x: Date) => x.toISOString().slice(0, 10);
  switch (p) {
    case 'today': return [iso(d), iso(d)];
    case 'week': { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); return [iso(s), iso(d)]; }
    case 'last_month': { const s = new Date(d.getFullYear(), d.getMonth() - 1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0); return [iso(s), iso(e)]; }
    case 'year': return [`${d.getFullYear()}-01-01`, iso(d)];
    case 'custom': return [from || '2000-01-01', to || iso(d)];
    default: { const s = new Date(d.getFullYear(), d.getMonth(), 1); return [iso(s), iso(d)]; } // month
  }
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const lang = await getLang();
  const sp = await searchParams;
  const [from, to] = range(sp.p, sp.from, sp.to);

  const card = async (sql: string, params: unknown[]) => num((await q1<{ v: number }>(sql, params))?.v);

  const [sales, purchases, collected, custDebt, suppDebt, prodCost, expenses, cogs, discounts, returns, invValue, cashIn, cashOut] = await Promise.all([
    card(`select coalesce(sum(total),0) v from sales_invoices where status='confirmed' and sale_date between $1 and $2`, [from, to]),
    card(`select coalesce(sum(total),0) v from purchase_invoices where status='confirmed' and purchase_date between $1 and $2`, [from, to]),
    card(`select coalesce(sum(amount),0) v from financial_transactions where direction='in' and tx_type='customer_payment' and tx_date between $1 and $2`, [from, to]),
    card(`select coalesce(sum(total-amount_paid),0) v from sales_invoices where status='confirmed'`, []),
    card(`select coalesce(sum(total-amount_paid),0) v from purchase_invoices where status='confirmed'`, []),
    card(`select coalesce(sum(total_cost),0) v from production_batches where status='completed' and start_date between $1 and $2`, [from, to]),
    card(`select coalesce(sum(amount),0) v from expenses where expense_date between $1 and $2`, [from, to]),
    card(`select coalesce(sum(cogs),0) v from sales_invoices where status='confirmed' and sale_date between $1 and $2`, [from, to]),
    card(`select coalesce(sum(discount),0) v from sales_invoices where status='confirmed' and sale_date between $1 and $2`, [from, to]),
    card(`select coalesce(sum(total),0) v from sales_returns where return_date between $1 and $2`, [from, to]),
    card(`select coalesce(sum(stock*avg_cost),0) v from products`, []),
    card(`select coalesce(sum(amount),0) v from financial_transactions where direction='in'`, []),
    card(`select coalesce(sum(amount),0) v from financial_transactions where direction='out'`, []),
  ]);
  const netSales = sales - returns;
  const gross = netSales - cogs;
  const net = gross - expenses;
  const cash = cashIn - cashOut;

  const monthly = await q(`select to_char(date_trunc('month', sale_date),'YYYY-MM') m, sum(total) v from sales_invoices where status='confirmed' group by 1 order by 1`);
  const monthlyExp = await q(`select to_char(date_trunc('month', expense_date),'YYYY-MM') m, sum(amount) v from expenses group by 1 order by 1`);
  const monthlyNet = await q(`select m, sum(profit) v from (
      select to_char(date_trunc('month', sale_date),'YYYY-MM') m, total-cogs profit from sales_invoices where status='confirmed'
      union all select to_char(date_trunc('month', expense_date),'YYYY-MM'), -amount from expenses) s group by 1 order by 1`);
  const byCat = await q(`select coalesce(c.name,'?') name, sum(si.total) value from sale_items si
      join products p on p.id=si.product_id left join categories c on c.id=p.category_id
      join sales_invoices s on s.id=si.invoice_id and s.status='confirmed' group by 1 order by 2 desc`);
  const mfgVs = await q(`select p.type name, sum(si.total) value from sale_items si join products p on p.id=si.product_id
      join sales_invoices s on s.id=si.invoice_id and s.status='confirmed' group by 1`);
  const top = await q(`select p.name, sum(si.quantity) v from sale_items si join products p on p.id=si.product_id
      join sales_invoices s on s.id=si.invoice_id and s.status='confirmed' group by 1 order by 2 desc limit 8`);
  const prof = await q(`select p.name, sum(si.quantity*(si.unit_price-si.unit_cost)) v from sale_items si
      join products p on p.id=si.product_id join sales_invoices s on s.id=si.invoice_id and s.status='confirmed'
      group by 1 order by 2 desc limit 8`);

  const cards: [string, number, boolean?][] = [
    [t('total_sales', lang), netSales], [t('total_purchases', lang), purchases],
    [t('collected', lang), collected], [t('customer_debts', lang), custDebt],
    [t('supplier_debts', lang), suppDebt], [t('production_costs', lang), prodCost],
    [t('op_expenses', lang), expenses], [t('gross_profit', lang), gross, true],
    [t('net_profit', lang), net, true], [t('inventory_value', lang), invValue],
    [t('cash_balance', lang), cash, true],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('dashboard', lang)}</h1>
        <DateFilter lang={lang} period={sp.p ?? 'month'} from={from} to={to} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(([label, v, signed]) => (
          <div key={label as string} className="card">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-xl font-bold mt-1 ${signed ? (num(v) >= 0 ? 'text-green-600' : 'text-red-600') : 'text-[#1f3147]'}`}>{fmtDZD(num(v), lang)}</div>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card"><h3 className="font-semibold mb-2">{t('monthly_revenue', lang)}</h3><Bars data={monthly as never} x="m" y="v" /></div>
        <div className="card"><h3 className="font-semibold mb-2">{t('monthly_expenses', lang)}</h3><Bars data={monthlyExp as never} x="m" y="v" /></div>
        <div className="card"><h3 className="font-semibold mb-2">{t('monthly_net_profit', lang)}</h3><Lines data={monthlyNet as never} x="m" y="v" /></div>
        <div className="card"><h3 className="font-semibold mb-2">{t('sales_by_category', lang)}</h3><PieC data={byCat as never} nameKey="name" valKey="value" /></div>
        <div className="card"><h3 className="font-semibold mb-2">{t('mfg_vs_resale', lang)}</h3><PieC data={(mfgVs as {name:string}[]).map(r => ({...r, name: t(r.name, lang)})) as never} nameKey="name" valKey="value" /></div>
        <div className="card"><h3 className="font-semibold mb-2">{t('top_products', lang)}</h3><Bars data={top as never} x="name" y="v" /></div>
        <div className="card"><h3 className="font-semibold mb-2">{t('most_profitable', lang)}</h3><Bars data={prof as never} x="name" y="v" /></div>
      </div>
    </div>
  );
}
