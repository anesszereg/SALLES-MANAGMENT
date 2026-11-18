import { cookies } from 'next/headers';
import type { Lang } from './i18n';

export function fmtDZD(n: number, lang: Lang = 'ar'): string {
  const locale = lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-DZ' : 'en-DZ';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n) + ' ' + (lang === 'ar' ? 'دج' : 'DA');
}

export async function getLang(): Promise<Lang> {
  const c = await cookies();
  const v = c.get('lang')?.value;
  return v === 'ar' || v === 'fr' ? v : 'en';
}

export async function isAuthed(): Promise<boolean> {
  const c = await cookies();
  return c.get('session')?.value === 'ok';
}
