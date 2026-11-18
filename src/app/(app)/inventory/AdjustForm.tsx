'use client';
import ActionForm from '@/components/ActionForm';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from '@/components/ui';
import { stockAdjustment } from '@/lib/actions';

export default function AdjustForm({ lang, products }: { lang: Lang; products: { id: string; name: string; reference: string }[] }) {
  const [open, openM, closeM] = useModal();
  return (
    <>
      <button onClick={openM} className="btn-ghost text-xs">+ {t('adjustment', lang)}</button>
      <Modal open={open} onClose={closeM} title={t('adjustment', lang)}>
        <ActionForm action={async fd => { await stockAdjustment(fd); closeM(); }} className="space-y-3">
          <select name="product_id" required className="input">
            <option value="">{t('product', lang)}…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.reference} · {p.name}</option>)}
          </select>
          <input name="quantity" type="number" step="any" required placeholder={`${t('quantity', lang)} (+/-)`} className="input" />
          <select name="reason" className="input">
            {['correction', 'damaged', 'loss', 'count'].map(r => <option key={r} value={r}>{r === 'damaged' ? t('damaged', lang) : r}</option>)}
          </select>
          <input name="note" placeholder={t('notes', lang)} className="input" />
          <button className="btn-primary w-full">{t('save', lang)}</button>
        </ActionForm>
      </Modal>
    </>
  );
}
