import { q, q1, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import DateFilter from '@/components/DateFilter';

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const lang = await getLang();
  const sp = await searchParams;
  const from = sp.from ?? '2000-01-01';
  const to = sp.to ?? '2100-01-01';

  const g = async (sql: string, p: unknown[]) => num((await q1<{ v: number }>(sql, p))?.v);
  const [sales, discounts, returns, cogs, returnCogs, expenses] = await Promise.all([
    g(`select coalesce(sum(subtotal),0) v from sales_invoices where status='confirmed' and sale_date between $1 and $2`, [from, to]),
    g(`select coalesce(sum(discount),0) v from sales_invoices where status='confirmed' and sale_date between $1 and $2`, [from, to]),
    g(`select coalesce(sum(total),0) v from sales_returns where return_date between $1 and $2`, [from, to]),
    g(`select coalesce(sum(cogs),0) v from sales_invoices where status='confirmed' and sale_date between $1 and $2`, [from, to]),
    g(`select coalesce(sum(cogs),0) v from sales_returns where return_date between $1 and $2`, [from, to]),
    g(`select coalesce(sum(amount),0) v from expenses where expense_date between $1 and $2`, [from, to]),
  ]);
  const netSales = sales - discounts - returns;
  const netCogs = cogs - returnCogs;
  const gross = netSales - netCogs;
  const net = gross - expenses;

  const [receivables, payables, invValue, cashBal, bankBal] = await Promise.all([
    g(`select coalesce(sum(total-amount_paid),0) v from sales_invoices where status='confirmed'`, []),
    g(`select coalesce(sum(total-amount_paid),0) v from purchase_invoices where status='confirmed'`, []),
    g(`select coalesce(sum(stock*avg_cost),0) v from products`, []),
    g(`select coalesce(sum(case when direction='in' then amount else -amount end),0) v from financial_transactions where account='cash'`, []),
    g(`select coalesce(sum(case when direction='in' then amount else -amount end),0) v from financial_transactions where account='bank'`, []),
  ]);

  const cashflow = await q(`select * from financial_transactions order by tx_date desc, created_at desc limit 100`);
  const byCat = await q(`select coalesce(c.name,'?') name, sum(e.amount) v from expenses e left join expense_categories c on c.id=e.category_id
    where e.expense_date between $1 and $2 group by 1 order by 2 desc`, [from, to]);

  const row = (label: string, v: number, bold = false, signed = false) => (
    <div key={label} className={`flex justify-between py-2 border-b border-gray-100 ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span className={signed ? (v >= 0 ? 'pos' : 'neg') : ''}>{fmtDZD(v, lang)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('finance', lang)}</h1>
        <DateFilter lang={lang} period={sp.p ?? 'custom'} from={from === '2000-01-01' ? '' : from} to={to === '2100-01-01' ? '' : to} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-2">{t('profit_loss', lang)}</h3>
          {row(t('total_sales', lang), sales)}
          {row(t('discount', lang), -discounts)}
          {row(t('sales_return', lang), -returns)}
          {row(t('revenue', lang) + ' (' + t('total', lang) + ')', netSales, true)}
          {row(t('cogs', lang), -netCogs)}
          {row(t('gross_profit', lang), gross, true, true)}
          {row(t('op_expenses', lang), -expenses)}
          {row(t('net_profit', lang), net, true, true)}
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">{t('dashboard', lang)}</h3>
          {row(t('receivables', lang), receivables)}
          {row(t('payables', lang), payables)}
          {row(t('inventory_value', lang), invValue)}
          {row(t('cash', lang), cashBal, false, true)}
          {row(t('bank', lang), bankBal, false, true)}
          <h3 className="font-semibold mt-4 mb-2">{t('op_expenses', lang)}</h3>
          {(byCat as Record<string, unknown>[]).map(c => row(c.name as string, num(c.v)))}
        </div>
      </div>
      <div className="card p-0 overflow-x-auto">
        <h3 className="font-semibold px-4 pt-3">{t('cash_flow', lang)}</h3>
        <table className="w-full">
          <thead><tr><th className="th">{t('date', lang)}</th><th className="th">{t('type', lang)}</th><th className="th">{t('payment_method', lang)}</th><th className="th">{t('amount', lang)}</th><th className="th">{t('notes', lang)}</th></tr></thead>
          <tbody>{(cashflow as Record<string, unknown>[]).map(x => (
            <tr key={x.id as string}>
              <td className="td">{String(x.tx_date).slice(0, 10)}</td>
              <td className="td text-xs">{x.tx_type as string}</td>
              <td className="td text-xs">{x.account as string}</td>
              <td className={`td font-semibold ${x.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                {x.direction === 'in' ? '+' : '−'}{fmtDZD(num(x.amount), lang)}</td>
              <td className="td text-xs text-gray-500">{x.note as string ?? ''}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
