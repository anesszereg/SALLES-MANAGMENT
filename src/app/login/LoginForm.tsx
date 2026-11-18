'use client';
import { useActionState } from 'react';
import { notify } from '@/components/ActionForm';
import { t, type Lang } from '@/lib/i18n';

export default function LoginForm({ action, lang }: { action: (p: unknown, f: FormData) => Promise<{ error: string } | undefined>; lang: Lang }) {
  const [state, formAction, pending] = useActionState(async (previous: unknown, data: FormData) => {
    try {
      const result = await action(previous, data);
      if (result?.error) notify(lang === 'ar' ? 'كلمة المرور غير صحيحة' : lang === 'fr' ? 'Mot de passe incorrect' : 'Invalid password', 'error');
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('NEXT_REDIRECT')) throw error;
      const message = lang === 'ar' ? 'تعذر تسجيل الدخول' : lang === 'fr' ? 'Impossible de se connecter' : 'Unable to sign in';
      notify(message, 'error');
      return { error: message };
    }
  }, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <input name="password" type="password" required placeholder={t('password', lang)} className="input" autoFocus />
      {state?.error && <p className="neg text-sm">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{t('login', lang)}</button>
    </form>
  );
}
