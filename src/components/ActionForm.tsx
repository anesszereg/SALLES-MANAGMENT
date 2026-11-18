'use client';

import { useState, type ComponentProps } from 'react';

export function notify(message: string, kind: 'success' | 'error' = 'success') {
  window.dispatchEvent(new CustomEvent('erp-toast', { detail: { message, kind } }));
}

export default function ActionForm({ action, children, ...props }: Omit<ComponentProps<'form'>, 'action'> & {
  action: (data: FormData) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const lang = () => document.documentElement.lang;
  return (
    <form {...props} action={async data => {
      if (pending) return;
      setPending(true);
      try {
        await action(data);
        notify(lang() === 'ar' ? 'تمت العملية بنجاح' : lang() === 'fr' ? 'Opération réussie' : 'Operation completed successfully');
      } catch {
        notify(lang() === 'ar' ? 'تعذر إتمام العملية. تحقق من البيانات وحاول مجددا.' : lang() === 'fr' ? 'Impossible de terminer. Vérifiez les données et réessayez.' : 'Unable to complete the operation. Check your inputs and try again.', 'error');
      } finally {
        setPending(false);
      }
    }}>
      <fieldset disabled={pending} className="contents" aria-busy={pending}>{children}</fieldset>
    </form>
  );
}
