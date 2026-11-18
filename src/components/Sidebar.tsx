'use client';
import Link from 'next/link';
import { notify } from './ActionForm';
import { usePathname } from 'next/navigation';
import { t, type Lang } from '@/lib/i18n';
import { logoutAction, setLangAction } from '@/lib/actions';

const items = ['dashboard','products','production','inventory','purchases','sales','customers','suppliers','expenses','finance','reports','settings'];
const href = (k: string) => (k === 'dashboard' ? '/' : `/${k}`);

export default function Sidebar({ lang, business }: { lang: Lang; business: string }) {
  const path = usePathname();
  return (
    <aside className="w-60 shrink-0 bg-[#1f3147] text-white flex flex-col no-print sticky top-0 h-screen">
      <div className="p-4 border-b border-white/10">
        <div className="font-bold">{business || t('app_name', lang)}</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {items.map(k => (
          <Link key={k} href={href(k)}
            className={`block rounded-lg px-3 py-2 text-sm ${path === href(k) ? 'bg-white/15 font-semibold' : 'hover:bg-white/10 text-gray-200'}`}>
            {t(k, lang)}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10 flex items-center justify-between gap-2">
        <select defaultValue={lang} onChange={async e => {
          const nextLang = e.target.value;
          try {
            await setLangAction(nextLang);
            notify(nextLang === 'ar' ? 'تم تغيير اللغة' : nextLang === 'fr' ? 'Langue modifiée' : 'Language updated');
          } catch {
            notify(lang === 'ar' ? 'تعذر تغيير اللغة' : lang === 'fr' ? 'Impossible de changer la langue' : 'Unable to change language', 'error');
          }
        }} className="bg-white/10 text-sm rounded px-2 py-1">
          <option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option>
        </select>
        <button onClick={async () => {
          try {
            await logoutAction();
          } catch (error) {
            if (error instanceof Error && error.message.startsWith('NEXT_REDIRECT')) throw error;
            notify(lang === 'ar' ? 'تعذر تسجيل الخروج' : lang === 'fr' ? 'Impossible de se déconnecter' : 'Unable to sign out', 'error');
          }
        }} className="text-xs text-gray-300 hover:text-white">{t('logout', lang)}</button>
      </div>
    </aside>
  );
}
