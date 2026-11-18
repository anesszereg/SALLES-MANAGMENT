'use client';
import { t, type Lang } from '@/lib/i18n';
import { notify } from './ActionForm';

export default function PrintBtn({ lang }: { lang: Lang }) {
  return <button onClick={() => {
    try {
      window.print();
      notify(lang === 'ar' ? 'تم فتح نافذة الطباعة' : lang === 'fr' ? 'Dialogue d’impression ouvert' : 'Print dialog opened');
    } catch {
      notify(lang === 'ar' ? 'تعذر فتح الطباعة' : lang === 'fr' ? 'Impossible d’ouvrir l’impression' : 'Unable to open print dialog', 'error');
    }
  }} className="btn-primary no-print">{t('print', lang)}</button>;
}
