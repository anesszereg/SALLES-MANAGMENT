'use client';

import { useState } from 'react';
import { t, type Lang } from '@/lib/i18n';
import { notify } from './ActionForm';

export default function ExportButton({ report, lang }: { report: string; lang: Lang }) {
  const [pending, setPending] = useState(false);
  return <button className="btn-ghost text-xs" disabled={pending} onClick={async () => {
    setPending(true);
    try {
      const response = await fetch(`/api/csv?r=${encodeURIComponent(report)}`);
      if (!response.ok) throw new Error('Export failed');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(lang === 'ar' ? 'تم تجهيز التقرير للتنزيل' : lang === 'fr' ? 'Rapport prêt à télécharger' : 'Report ready for download');
    } catch {
      notify(lang === 'ar' ? 'تعذر تصدير التقرير' : lang === 'fr' ? 'Impossible d’exporter le rapport' : 'Unable to export report', 'error');
    } finally {
      setPending(false);
    }
  }}>{t('export_csv', lang)}</button>;
}
