import { q, q1, num } from '@/lib/db';
import { getLang, isAuthed } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import { DocHeader, ItemsTable, Totals, PrintShell } from '@/components/PrintDoc';
import PrintBtn from '@/components/PrintBtn';
import { notFound, redirect } from 'next/navigation';

export default async function PrintPurchase({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) redirect('/login');
  const lang = await getLang();
  const { id } = await params;
  const inv = await q1<Record<string, unknown>>(
    `select pi.*, s.name sname, s.phone sphone, s.address saddr from purchase_invoices pi left join suppliers s on s.id=pi.supplier_id where pi.id=$1`, [id]);
  if (!inv) notFound();
  const items = await q(`select p.name, pi.quantity, pi.unit_price, pi.total from purchase_items pi join products p on p.id=pi.product_id where pi.invoice_id=$1`, [id]);
  return (
    <PrintShell>
      <DocHeader title={t('invoice', lang) + ' — ' + t('purchases', lang)} docNo={String(inv.invoice_number)}
        date={String(inv.purchase_date).slice(0, 10)} partyLabel={t('supplier', lang)}
        party={{ name: inv.sname as string, phone: inv.sphone as string, address: inv.saddr as string }} />
      <ItemsTable lang={lang} items={items as never} />
      <Totals lang={lang} rows={[
        [t('subtotal', lang), num(inv.subtotal)], [t('extra_costs', lang), num(inv.extra_costs)],
        [t('total', lang), num(inv.total)], [t('paid', lang), num(inv.amount_paid)],
        [t('balance', lang), num(inv.total) - num(inv.amount_paid)],
      ]} />
      <div className="mt-6 no-print"><PrintBtn lang={lang} /></div>
    </PrintShell>
  );
}
