import ActionForm from '@/components/ActionForm';
import { q, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import NewSale from './NewSale';
import ReturnForm from './ReturnForm';
import { cancelSale } from '@/lib/actions';

export default async function SalesPage() {
  const lang = await getLang();
  const invoices = await q(
    `select si.*, c.name customer from sales_invoices si left join customers c on c.id=si.customer_id order by si.sale_date desc, si.created_at desc`);
  const customers = await q('select id,name from customers order by name');
  const products = await q(`select id,name,reference,selling_price,stock from products where type != 'raw_material' order by name`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('sales', lang)}</h1>
        <NewSale lang={lang} customers={customers as never} products={products as never} />
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">{t('invoice_number', lang)}</th><th className="th">{t('date', lang)}</th><th className="th">{t('customer', lang)}</th>
            <th className="th">{t('subtotal', lang)}</th><th className="th">{t('discount', lang)}</th><th className="th">{t('total', lang)}</th>
            <th className="th">{t('paid', lang)}</th><th className="th">{t('balance', lang)}</th><th className="th">{t('status', lang)}</th><th className="th"></th>
          </tr></thead>
          <tbody>{(invoices as Record<string, unknown>[]).map(i => (
            <tr key={i.id as string} className={i.status === 'cancelled' ? 'opacity-50' : ''}>
              <td className="td font-mono text-xs">{i.invoice_number as string}</td>
              <td className="td">{String(i.sale_date).slice(0, 10)}</td>
              <td className="td">{i.customer as string ?? '—'}</td>
              <td className="td">{fmtDZD(num(i.subtotal), lang)}</td>
              <td className="td">{fmtDZD(num(i.discount), lang)}</td>
              <td className="td font-semibold">{fmtDZD(num(i.total), lang)}</td>
              <td className="td">{fmtDZD(num(i.amount_paid), lang)}</td>
              <td className={`td ${num(i.total) - num(i.amount_paid) > 0 ? 'neg' : 'pos'}`}>{fmtDZD(num(i.total) - num(i.amount_paid), lang)}</td>
              <td className="td text-xs">{t(i.status as string, lang)}</td>
              <td className="td">
                <div className="flex gap-1">
                  <a className="btn-ghost text-xs" href={`/print/sale/${i.id}`}>{t('print', lang)}</a>
                  {i.status === 'confirmed' && <>
                    <ReturnForm lang={lang} invoiceId={i.id as string} />
                    <ActionForm action={cancelSale.bind(null, i.id as string)}><button className="btn-ghost text-xs text-red-600">{t('cancel_invoice', lang)}</button></ActionForm>
                  </>}
                </div>
              </td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
