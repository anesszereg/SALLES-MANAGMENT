'use client';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from '@/components/ui';
import InvoiceForm, { type Party, type Prod } from '@/components/InvoiceForm';
import { createPurchase } from '@/lib/actions';

export default function NewPurchase({ lang, suppliers, products }: { lang: Lang; suppliers: Party[]; products: Prod[] }) {
  const [open, openM, closeM] = useModal();
  return (
    <>
      <button onClick={openM} className="btn-primary">+ {t('new_purchase', lang)}</button>
      <Modal open={open} onClose={closeM} title={t('new_purchase', lang)} wide>
        <InvoiceForm mode="purchase" lang={lang} parties={suppliers} products={products}
          action={async fd => { await createPurchase(fd); closeM(); }} />
      </Modal>
    </>
  );
}
