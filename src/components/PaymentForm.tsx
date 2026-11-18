'use client';
import ActionForm from './ActionForm';
import { t, type Lang } from '@/lib/i18n';

export default function PaymentForm({ lang, ownerField, ownerId, action, invoiceId }: {
  lang: Lang; ownerField: 'customer_id' | 'supplier_id'; ownerId: string;
  action: (fd: FormData) => Promise<void>; invoiceId?: string;
}) {
  return (
    <ActionForm action={action} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
      <input type="hidden" name={ownerField} value={ownerId} />
      {invoiceId && <input type="hidden" name="invoice_id" value={invoiceId} />}
      <div><label className="text-xs text-gray-500">{t('amount', lang)}</label><input name="amount" type="number" min="0.01" step="any" required className="input" /></div>
      <div><label className="text-xs text-gray-500">{t('date', lang)}</label><input name="payment_date" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
      <div><label className="text-xs text-gray-500">{t('payment_method', lang)}</label>
        <select name="payment_method" className="input"><option value="cash">{t('cash', lang)}</option><option value="bank">{t('bank', lang)}</option></select></div>
      <input name="notes" placeholder={t('notes', lang)} className="input" />
      <button className="btn-primary">{t('record_payment', lang)}</button>
    </ActionForm>
  );
}
