'use client';
import ActionForm, { notify } from '@/components/ActionForm';
import { useState } from 'react';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from '@/components/ui';
import { createSalesReturn, getSaleItems } from '@/lib/actions';

type Item = { product_id: string; quantity: number; unit_price: number; unit_cost: number; name: string };

export default function ReturnForm({ lang, invoiceId }: { lang: Lang; invoiceId: string }) {
  const [open, openM, closeM] = useModal();
  const [items, setItems] = useState<Item[]>([]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const load = async () => {
    try {
      setItems(await getSaleItems(invoiceId) as Item[]);
      openM();
    } catch {
      notify(lang === 'ar' ? 'تعذر تحميل العناصر' : lang === 'fr' ? 'Impossible de charger les articles' : 'Unable to load invoice items', 'error');
    }
  };
  return (
    <>
      <button onClick={load} className="btn-ghost text-xs">{t('sales_return', lang)}</button>
      <Modal open={open} onClose={closeM} title={t('sales_return', lang)} wide>
        <ActionForm action={async fd => {
          const sel = items.filter(i => (qtys[i.product_id] ?? 0) > 0)
            .map(i => ({ product_id: i.product_id, quantity: qtys[i.product_id], unit_price: i.unit_price, unit_cost: i.unit_cost }));
          if (!sel.length) throw new Error('Select items to return');
          fd.set('invoice_id', invoiceId); fd.set('items', JSON.stringify(sel));
          await createSalesReturn(fd); closeM();
        }} className="space-y-3">
          <table className="w-full">
            <thead><tr><th className="th">{t('product', lang)}</th><th className="th">{t('quantity', lang)}</th><th className="th">{t('sales_return', lang)}</th></tr></thead>
            <tbody>{items.map(i => (
              <tr key={i.product_id}>
                <td className="td">{i.name}</td>
                <td className="td">{i.quantity}</td>
                <td className="td w-28"><input type="number" min={0} max={Number(i.quantity)} step="any" className="input"
                  value={qtys[i.product_id] ?? 0} onChange={e => setQtys(s => ({ ...s, [i.product_id]: Number(e.target.value) }))} /></td>
              </tr>))}
            </tbody>
          </table>
          <input name="reason" placeholder={t('reason', lang)} className="input" />
          <button className="btn-primary w-full">{t('confirm', lang)}</button>
        </ActionForm>
      </Modal>
    </>
  );
}
