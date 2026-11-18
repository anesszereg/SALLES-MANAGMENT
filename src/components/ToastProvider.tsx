'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { notify } from './ActionForm';

type Toast = { id: number; message: string; kind: 'success' | 'error' };

export default function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    let sequence = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<Omit<Toast, 'id'>>).detail;
      const id = ++sequence;
      setToasts(current => [...current.slice(-3), { ...detail, id }]);
      const timer = setTimeout(() => {
        setToasts(current => current.filter(item => item.id !== id));
        timers.delete(timer);
      }, detail.kind === 'error' ? 8000 : 4500);
      timers.add(timer);
    };
    window.addEventListener('erp-toast', receive);
    return () => {
      window.removeEventListener('erp-toast', receive);
      timers.forEach(clearTimeout);
    };
  }, []);
  const pathname = usePathname();
  useEffect(() => {
    const flash = document.cookie.split('; ').find(value => value.startsWith('erp-flash='))?.split('=')[1];
    if (!flash) return;
    document.cookie = 'erp-flash=; Max-Age=0; Path=/; SameSite=Lax';
    const lang = document.documentElement.lang;
    notify(flash === 'login'
      ? (lang === 'ar' ? 'تم تسجيل الدخول' : lang === 'fr' ? 'Connexion réussie' : 'Signed in successfully')
      : (lang === 'ar' ? 'تم تسجيل الخروج' : lang === 'fr' ? 'Déconnexion réussie' : 'Signed out successfully'));
  }, [pathname]);
  return (
    <div className="fixed bottom-5 end-5 z-[100] flex w-96 max-w-[calc(100vw-2.5rem)] flex-col gap-3 no-print" aria-label="Notifications">
      {toasts.map(item => (
        <div key={item.id} role={item.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-4 rounded-xl border bg-white p-4 shadow-lg ${item.kind === 'error' ? 'border-red-300 text-red-800' : 'border-green-300 text-green-800'}`}>
          <p className="text-sm font-medium">{item.message}</p>
          <button type="button" aria-label="Dismiss notification" className="shrink-0 px-1 text-lg leading-none" onClick={() => setToasts(current => current.filter(t => t.id !== item.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
