'use client';
import ActionForm from './ActionForm';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from './ui';

export default function PartyForm({ lang, action, label, initial }: {
  lang: Lang; action: (fd: FormData) => Promise<void>; label: string;
  initial?: Record<string, unknown>;
}) {
  const [open, openM, closeM] = useModal();
  return (
    <>
      <button onClick={openM} className={initial ? 'btn-ghost text-xs' : 'btn-primary'}>{initial ? label : `+ ${label}`}</button>
      <Modal open={open} onClose={closeM} title={label}>
        <ActionForm action={async fd => { await action(fd); closeM(); }} className="space-y-3">
          {initial && <input type="hidden" name="id" value={String(initial.id)} />}
          <input name="name" required placeholder={t('name', lang)} defaultValue={String(initial?.name ?? '')} className="input" />
          <input name="phone" placeholder={t('phone', lang)} defaultValue={String(initial?.phone ?? '')} className="input" />
          <input name="address" placeholder={t('address', lang)} defaultValue={String(initial?.address ?? '')} className="input" />
          <input name="notes" placeholder={t('notes', lang)} defaultValue={String(initial?.notes ?? '')} className="input" />
          <button className="btn-primary w-full">{t('save', lang)}</button>
        </ActionForm>
      </Modal>
    </>
  );
}
