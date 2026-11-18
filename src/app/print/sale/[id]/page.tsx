import { q, q1, num } from '@/lib/db';
import { getLang, isAuthed } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import { DocHeader, ItemsTable, Totals, PrintShell } from '@/components/PrintDoc';
import PrintBtn from '@/components/PrintBtn';
import { notFound, redirect } from 'next/navigation';

export default async function PrintSale({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) redirect('/login');
  const lang = await getLang();
  const { id } = await params;
  const inv = await q1<Record<string, unknown>>(
    `select si.*, c.name cname, c.phone cphone, c.address caddr from sales_invoices si left join customers c on c.id=si.customer_id where si.id=$1`, [id]);
  if (!inv) notFound();
  const items = await q(`select p.name, si.quantity, si.unit_price, si.total from sale_items si join products p on p.id=si.product_id where si.invoice_id=$1`, [id]);
  return (
    <PrintShell>
      <DocHeader title={t('invoice', lang) + ' — ' + t('sales', lang)} docNo={String(inv.invoice_number)}
        date={String(inv.sale_date).slice(0, 10)} partyLabel={t('customer', lang)}
        party={{ name: inv.cname as string, phone: inv.cphone as string, address: inv.caddr as string }} />
      <ItemsTable lang={lang} items={items as never} />
      <Totals lang={lang} rows={[
        [t('subtotal', lang), num(inv.subtotal)], [t('discount', lang), -num(inv.discount)],
        [t('total', lang), num(inv.total)], [t('paid', lang), num(inv.amount_paid)],
        [t('balance', lang), num(inv.total) - num(inv.amount_paid)],
      ]} />
      <div className="mt-6 no-print"><PrintBtn lang={lang} /></div>
    </PrintShell>
  );
}
