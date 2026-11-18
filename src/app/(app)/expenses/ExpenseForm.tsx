'use client';
import ActionForm from '@/components/ActionForm';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from '@/components/ui';
import { saveExpense } from '@/lib/actions';

export default function ExpenseForm({ lang, cats }: { lang: Lang; cats: { id: string; name: string }[] }) {
  const [open, openM, closeM] = useModal();
  return (
    <>
      <button onClick={openM} className="btn-primary">+ {t('new_expense', lang)}</button>
      <Modal open={open} onClose={closeM} title={t('new_expense', lang)}>
        <ActionForm action={async fd => { await saveExpense(fd); closeM(); }} className="space-y-3">
          <input name="expense_date" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
          <select name="category_id" className="input">
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input name="amount" type="number" min="0.01" step="any" required placeholder={t('amount', lang)} className="input" />
          <input name="description" placeholder={t('description', lang)} className="input" />
          <select name="payment_method" className="input"><option value="cash">{t('cash', lang)}</option><option value="bank">{t('bank', lang)}</option></select>
          <button className="btn-primary w-full">{t('save', lang)}</button>
        </ActionForm>
      </Modal>
    </>
  );
}
