import { q, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import PartyForm from '@/components/PartyForm';
import { saveSupplier } from '@/lib/actions';

export default async function SuppliersPage() {
  const lang = await getLang();
  const rows = await q(
    `select s.*, coalesce((select sum(total) from purchase_invoices where supplier_id=s.id and status='confirmed'),0) purchases,
            coalesce((select sum(amount_paid) from purchase_invoices where supplier_id=s.id and status='confirmed'),0) paid
     from suppliers s order by s.name`);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('suppliers', lang)}</h1>
        <PartyForm lang={lang} action={saveSupplier} label={t('new_supplier', lang)} />
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">{t('name', lang)}</th><th className="th">{t('phone', lang)}</th><th className="th">{t('total_purchases', lang)}</th><th className="th">{t('total_paid', lang)}</th><th className="th">{t('balance', lang)}</th><th className="th"></th></tr></thead>
          <tbody>{(rows as Record<string, unknown>[]).map(s => (
            <tr key={s.id as string}>
              <td className="td font-medium"><a href={`/suppliers/${s.id}`} className="text-[#1f3147] hover:underline">{s.name as string}</a></td>
              <td className="td">{s.phone as string ?? '—'}</td>
              <td className="td">{fmtDZD(num(s.purchases), lang)}</td>
              <td className="td">{fmtDZD(num(s.paid), lang)}</td>
              <td className={`td ${num(s.purchases) - num(s.paid) > 0 ? 'neg' : 'pos'}`}>{fmtDZD(num(s.purchases) - num(s.paid), lang)}</td>
              <td className="td"><PartyForm lang={lang} action={saveSupplier} label={t('edit', lang)} initial={s} /></td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
