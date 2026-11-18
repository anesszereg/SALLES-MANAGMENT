import { q, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import PartyForm from '@/components/PartyForm';
import { saveCustomer } from '@/lib/actions';

export default async function CustomersPage() {
  const lang = await getLang();
  const rows = await q(
    `select c.*, coalesce((select sum(total) from sales_invoices where customer_id=c.id and status='confirmed'),0) purchases,
            coalesce((select sum(amount_paid) from sales_invoices where customer_id=c.id and status='confirmed'),0) paid
     from customers c order by c.name`);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('customers', lang)}</h1>
        <PartyForm lang={lang} action={saveCustomer} label={t('new_customer', lang)} />
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">{t('name', lang)}</th><th className="th">{t('phone', lang)}</th><th className="th">{t('total_sales', lang)}</th><th className="th">{t('total_paid', lang)}</th><th className="th">{t('balance', lang)}</th><th className="th"></th></tr></thead>
          <tbody>{(rows as Record<string, unknown>[]).map(c => (
            <tr key={c.id as string}>
              <td className="td font-medium"><a href={`/customers/${c.id}`} className="text-[#1f3147] hover:underline">{c.name as string}</a></td>
              <td className="td">{c.phone as string ?? '—'}</td>
              <td className="td">{fmtDZD(num(c.purchases), lang)}</td>
              <td className="td">{fmtDZD(num(c.paid), lang)}</td>
              <td className={`td ${num(c.purchases) - num(c.paid) > 0 ? 'neg' : 'pos'}`}>{fmtDZD(num(c.purchases) - num(c.paid), lang)}</td>
              <td className="td"><PartyForm lang={lang} action={saveCustomer} label={t('edit', lang)} initial={c} /></td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
