import { q, q1, num } from '@/lib/db';
import { getLang, isAuthed, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import { DocHeader, Totals, PrintShell } from '@/components/PrintDoc';
import PrintBtn from '@/components/PrintBtn';
import { notFound, redirect } from 'next/navigation';

export default async function PrintBatch({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) redirect('/login');
  const lang = await getLang();
  const { id } = await params;
  const b = await q1<Record<string, unknown>>(
    `select b.*, p.name pname from production_batches b join products p on p.id=b.product_id where b.id=$1`, [id]);
  if (!b) notFound();
  const items = await q(`select p.name, bi.quantity, bi.unit_cost, bi.total from production_batch_items bi join products p on p.id=bi.material_id where bi.batch_id=$1`, [id]);
  return (
    <PrintShell>
      <DocHeader title={t('production', lang) + ' — ' + t('batch', lang)} docNo={String(b.batch_number)}
        date={String(b.start_date).slice(0, 10)} />
      <p className="mb-3">{t('product', lang)}: <b>{b.pname as string}</b> — {t('quantity', lang)}: {num(b.quantity_completed)}</p>
      <table className="w-full border-collapse mb-4">
        <thead><tr className="bg-gray-100"><th className="border p-2 text-start">{t('materials', lang)}</th><th className="border p-2">{t('quantity', lang)}</th><th className="border p-2">{t('unit_cost', lang)}</th><th className="border p-2">{t('total', lang)}</th></tr></thead>
        <tbody>{(items as Record<string, unknown>[]).map((i, k) => (
          <tr key={k}><td className="border p-2">{i.name as string}</td><td className="border p-2 text-center">{num(i.quantity)}</td>
            <td className="border p-2 text-center">{fmtDZD(num(i.unit_cost), lang)}</td><td className="border p-2 text-center">{fmtDZD(num(i.total), lang)}</td></tr>))}
        </tbody>
      </table>
      <Totals lang={lang} rows={[
        [t('material_cost', lang), num(b.material_cost)], [t('labor_cost', lang), num(b.labor_cost)],
        [t('transport_cost', lang), num(b.transport_cost)], [t('other_cost', lang), num(b.other_cost)],
        [t('total_cost', lang), num(b.total_cost)], [t('unit_cost', lang), num(b.unit_cost)],
      ]} />
      <div className="mt-6 no-print"><PrintBtn lang={lang} /></div>
    </PrintShell>
  );
}
