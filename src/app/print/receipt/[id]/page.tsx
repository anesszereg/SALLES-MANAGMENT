import { q1, num } from '@/lib/db';
import { getLang, isAuthed, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import { DocHeader, PrintShell } from '@/components/PrintDoc';
import PrintBtn from '@/components/PrintBtn';
import { notFound, redirect } from 'next/navigation';

export default async function PrintReceipt({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) redirect('/login');
  const lang = await getLang();
  const { id } = await params;
  const p = await q1<Record<string, unknown>>(
    `select cp.*, c.name cname, c.phone cphone, si.invoice_number from customer_payments cp
     left join customers c on c.id=cp.customer_id left join sales_invoices si on si.id=cp.invoice_id where cp.id=$1`, [id]);
  if (!p) notFound();
  return (
    <PrintShell>
      <DocHeader title={t('customer_payments', lang) + ' — ' + t('invoice', lang)} docNo={String(p.id).slice(0, 8)}
        date={String(p.payment_date).slice(0, 10)} partyLabel={t('customer', lang)} party={{ name: p.cname as string, phone: p.cphone as string }} />
      <div className="text-lg space-y-2">
        <p>{t('amount', lang)}: <b className="text-2xl">{fmtDZD(num(p.amount), lang)}</b></p>
        <p>{t('invoice', lang)}: {p.invoice_number as string ?? '—'}</p>
        <p>{t('payment_method', lang)}: {p.payment_method as string}</p>
        <p>{t('notes', lang)}: {p.notes as string ?? '—'}</p>
      </div>
      <div className="mt-6 no-print"><PrintBtn lang={lang} /></div>
    </PrintShell>
  );
}
