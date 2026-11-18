import { q1, num } from '@/lib/db';
import { getLang, isAuthed, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import { DocHeader, PrintShell } from '@/components/PrintDoc';
import PrintBtn from '@/components/PrintBtn';
import { notFound, redirect } from 'next/navigation';

export default async function PrintSupplierReceipt({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) redirect('/login');
  const lang = await getLang();
  const { id } = await params;
  const p = await q1<Record<string, unknown>>(
    `select sp.*, s.name sname, s.phone sphone, pi.invoice_number from supplier_payments sp
     left join suppliers s on s.id=sp.supplier_id left join purchase_invoices pi on pi.id=sp.invoice_id where sp.id=$1`, [id]);
  if (!p) notFound();
  return (
    <PrintShell>
      <DocHeader title={t('supplier_payments', lang)} docNo={String(p.id).slice(0, 8)}
        date={String(p.payment_date).slice(0, 10)} partyLabel={t('supplier', lang)} party={{ name: p.sname as string, phone: p.sphone as string }} />
      <div className="text-lg space-y-2">
        <p>{t('amount', lang)}: <b className="text-2xl">{fmtDZD(num(p.amount), lang)}</b></p>
        <p>{t('invoice', lang)}: {p.invoice_number as string ?? '—'}</p>
        <p>{t('payment_method', lang)}: {p.payment_method as string}</p>
      </div>
      <div className="mt-6 no-print"><PrintBtn lang={lang} /></div>
    </PrintShell>
  );
}
