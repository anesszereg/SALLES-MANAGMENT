'use client';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@/lib/i18n';

export default function DateFilter({ lang, period, from, to }: { lang: Lang; period: string; from: string; to: string }) {
  const r = useRouter();
  const go = (p: string, f?: string, tt?: string) => r.push(`?p=${p}${p === 'custom' ? `&from=${f}&to=${tt}` : ''}`);
  const opts = ['today', 'week', 'month', 'last_month', 'year', 'custom'];
  const key: Record<string, string> = { today: 'today', week: 'this_week', month: 'this_month', last_month: 'last_month', year: 'this_year', custom: 'custom' };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {opts.map(o => (
        <button key={o} onClick={() => go(o, from, to)}
          className={`btn text-xs ${period === o ? 'bg-[#1f3147] text-white' : 'border border-gray-300 bg-white'}`}>
          {t(key[o], lang)}
        </button>
      ))}
      {period === 'custom' && (
        <>
          <input type="date" defaultValue={from} className="input w-auto" onChange={e => go('custom', e.target.value, to)} />
          <input type="date" defaultValue={to} className="input w-auto" onChange={e => go('custom', from, e.target.value)} />
        </>
      )}
    </div>
  );
}
