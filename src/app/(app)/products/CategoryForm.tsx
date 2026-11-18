'use client';
import ActionForm from '@/components/ActionForm';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from '@/components/ui';
import { addCategory } from '@/lib/actions';

export default function CategoryForm({ lang }: { lang: Lang }) {
  const [open, openM, closeM] = useModal();
  return (
    <>
      <button onClick={openM} className="btn-ghost">+ {t('category', lang)}</button>
      <Modal open={open} onClose={closeM} title={t('category', lang)}>
        <ActionForm action={async fd => { await addCategory(fd); closeM(); }} className="space-y-3">
          <input name="name" required placeholder={t('name', lang)} className="input" />
          <button className="btn-primary w-full">{t('save', lang)}</button>
        </ActionForm>
      </Modal>
    </>
  );
}
