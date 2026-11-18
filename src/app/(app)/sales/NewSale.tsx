'use client';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from '@/components/ui';
import InvoiceForm, { type Party, type Prod } from '@/components/InvoiceForm';
import { createSale } from '@/lib/actions';

export default function NewSale({ lang, customers, products }: { lang: Lang; customers: Party[]; products: Prod[] }) {
  const [open, openM, closeM] = useModal();
  return (
    <>
      <button onClick={openM} className="btn-primary">+ {t('new_sale', lang)}</button>
      <Modal open={open} onClose={closeM} title={t('new_sale', lang)} wide>
        <InvoiceForm mode="sale" lang={lang} parties={customers} products={products}
          action={async fd => { await createSale(fd); closeM(); }} />
      </Modal>
    </>
  );
}
