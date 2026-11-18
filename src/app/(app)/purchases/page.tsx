import { q, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import NewPurchase from './NewPurchase';

export default async function PurchasesPage() {
  const lang = await getLang();
  const invoices = await q(
    `select pi.*, s.name supplier from purchase_invoices pi left join suppliers s on s.id=pi.supplier_id order by pi.purchase_date desc, pi.created_at desc`);
  const suppliers = await q('select id,name from suppliers order by name');
  const products = await q(`select id,name,reference,selling_price,stock from products order by name`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('purchases', lang)}</h1>
        <NewPurchase lang={lang} suppliers={suppliers as never} products={products as never} />
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">{t('invoice_number', lang)}</th><th className="th">{t('date', lang)}</th><th className="th">{t('supplier', lang)}</th>
            <th className="th">{t('category', lang)}</th><th className="th">{t('total', lang)}</th><th className="th">{t('paid', lang)}</th>
            <th className="th">{t('balance', lang)}</th><th className="th">{t('status', lang)}</th><th className="th"></th>
          </tr></thead>
          <tbody>{(invoices as Record<string, unknown>[]).map(i => (
            <tr key={i.id as string} className={i.status === 'cancelled' ? 'opacity-50 line-through' : ''}>
              <td className="td font-mono text-xs">{i.invoice_number as string}</td>
              <td className="td">{String(i.purchase_date).slice(0, 10)}</td>
              <td className="td">{i.supplier as string ?? '—'}</td>
              <td className="td text-xs">{i.category as string}</td>
              <td className="td font-semibold">{fmtDZD(num(i.total), lang)}</td>
              <td className="td">{fmtDZD(num(i.amount_paid), lang)}</td>
              <td className={`td ${num(i.total) - num(i.amount_paid) > 0 ? 'neg' : 'pos'}`}>{fmtDZD(num(i.total) - num(i.amount_paid), lang)}</td>
              <td className="td text-xs">{t(i.status as string, lang)}</td>
              <td className="td"><a className="btn-ghost text-xs" href={`/print/purchase/${i.id}`}>{t('print', lang)}</a></td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
