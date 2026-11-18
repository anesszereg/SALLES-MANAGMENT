import { q, q1, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import PaymentForm from '@/components/PaymentForm';
import { addCustomerPayment } from '@/lib/actions';
import { notFound } from 'next/navigation';

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const lang = await getLang();
  const { id } = await params;
  const c = await q1<Record<string, unknown>>('select * from customers where id=$1', [id]);
  if (!c) notFound();
  const invoices = await q(`select * from sales_invoices where customer_id=$1 order by sale_date desc`, [id]);
  const payments = await q(`select cp.*, si.invoice_number from customer_payments cp left join sales_invoices si on si.id=cp.invoice_id where cp.customer_id=$1 order by payment_date desc`, [id]);
  const total = (invoices as Record<string, unknown>[]).filter(i => i.status === 'confirmed').reduce((s, i) => s + num(i.total), 0);
  const paid = (invoices as Record<string, unknown>[]).filter(i => i.status === 'confirmed').reduce((s, i) => s + num(i.amount_paid), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1f3147]">{c.name as string}</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="card"><div className="text-xs text-gray-500">{t('total_sales', lang)}</div><div className="text-xl font-bold">{fmtDZD(total, lang)}</div></div>
        <div className="card"><div className="text-xs text-gray-500">{t('total_paid', lang)}</div><div className="text-xl font-bold">{fmtDZD(paid, lang)}</div></div>
        <div className="card"><div className="text-xs text-gray-500">{t('balance', lang)}</div><div className={`text-xl font-bold ${total - paid > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtDZD(total - paid, lang)}</div></div>
      </div>
      <div className="card">
        <h3 className="font-semibold mb-3">{t('record_payment', lang)}</h3>
        <PaymentForm lang={lang} ownerField="customer_id" ownerId={id} action={addCustomerPayment} />
      </div>
      <div className="card p-0 overflow-x-auto">
        <h3 className="font-semibold px-4 pt-3">{t('unpaid_invoices', lang)}</h3>
        <table className="w-full">
          <thead><tr><th className="th">{t('invoice_number', lang)}</th><th className="th">{t('date', lang)}</th><th className="th">{t('total', lang)}</th><th className="th">{t('paid', lang)}</th><th className="th">{t('balance', lang)}</th><th className="th"></th></tr></thead>
          <tbody>{(invoices as Record<string, unknown>[]).filter(i => i.status === 'confirmed').map(i => (
            <tr key={i.id as string}>
              <td className="td font-mono text-xs">{i.invoice_number as string}</td>
              <td className="td">{String(i.sale_date).slice(0, 10)}</td>
              <td className="td">{fmtDZD(num(i.total), lang)}</td>
              <td className="td">{fmtDZD(num(i.amount_paid), lang)}</td>
              <td className={`td ${num(i.total) - num(i.amount_paid) > 0 ? 'neg' : 'pos'}`}>{fmtDZD(num(i.total) - num(i.amount_paid), lang)}</td>
              <td className="td w-64">{num(i.total) - num(i.amount_paid) > 0 &&
                <PaymentForm lang={lang} ownerField="customer_id" ownerId={id} invoiceId={i.id as string} action={addCustomerPayment} />}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
      <div className="card p-0 overflow-x-auto">
        <h3 className="font-semibold px-4 pt-3">{t('payment_history', lang)}</h3>
        <table className="w-full">
          <thead><tr><th className="th">{t('date', lang)}</th><th className="th">{t('invoice', lang)}</th><th className="th">{t('amount', lang)}</th><th className="th">{t('payment_method', lang)}</th><th className="th"></th></tr></thead>
          <tbody>{(payments as Record<string, unknown>[]).map(p => (
            <tr key={p.id as string}>
              <td className="td">{String(p.payment_date).slice(0, 10)}</td>
              <td className="td font-mono text-xs">{p.invoice_number as string ?? '—'}</td>
              <td className="td">{fmtDZD(num(p.amount), lang)}</td>
              <td className="td">{p.payment_method as string}</td>
              <td className="td"><a className="btn-ghost text-xs" href={`/print/receipt/${p.id}`}>{t('print', lang)}</a></td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
