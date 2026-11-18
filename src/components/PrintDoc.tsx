import { fmtDZD, getLang } from '@/lib/helpers';
import { q, num } from '@/lib/db';
import { t, type Lang } from '@/lib/i18n';

export async function DocHeader({ title, docNo, date, partyLabel, party }: {
  title: string; docNo: string; date: string; partyLabel?: string; party?: { name?: string; phone?: string; address?: string } | null;
}) {
  const lang = await getLang();
  const s = await q('select key,value from business_settings');
  const get = (k: string) => String((s as { key: string; value: string }[]).find(r => r.key === k)?.value ?? '');
  return (
    <div>
      <div className="flex justify-between items-start border-b-2 border-[#1f3147] pb-4 mb-4">
        <div>
          {get('logo_url') ? <img src={get('logo_url')} alt="logo" className="h-14 mb-1" /> : null}
          <h1 className="text-2xl font-bold text-[#1f3147]">{get('business_name') || 'Lune Benif'}</h1>
          <p className="text-xs text-gray-500">{get('phone')} {get('address')}</p>
        </div>
        <div className="text-end">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="font-mono">{docNo}</p>
          <p className="text-sm text-gray-500">{date}</p>
        </div>
      </div>
      {party && (
        <div className="mb-4 text-sm">
          <span className="text-gray-500">{partyLabel}: </span>
          <b>{party.name}</b> {party.phone} {party.address}
        </div>
      )}
    </div>
  );
}

export function ItemsTable({ items, lang }: { items: { name: string; quantity: number; unit_price: number; total: number }[]; lang: Lang }) {
  return (
    <table className="w-full border-collapse mb-4">
      <thead><tr className="bg-gray-100">
        <th className="border p-2 text-start">{t('product', lang)}</th>
        <th className="border p-2">{t('quantity', lang)}</th>
        <th className="border p-2">{t('price', lang)}</th>
        <th className="border p-2">{t('total', lang)}</th>
      </tr></thead>
      <tbody>{items.map((i, k) => (
        <tr key={k}>
          <td className="border p-2">{i.name}</td>
          <td className="border p-2 text-center">{num(i.quantity)}</td>
          <td className="border p-2 text-center">{fmtDZD(num(i.unit_price), lang)}</td>
          <td className="border p-2 text-center">{fmtDZD(num(i.total), lang)}</td>
        </tr>))}
      </tbody>
    </table>
  );
}

export function Totals({ lang, rows }: { lang: Lang; rows: [string, number][] }) {
  return (
    <div className="ms-auto w-64 space-y-1">
      {rows.map(([l, v]) => (
        <div key={l} className="flex justify-between text-sm border-b py-1">
          <span>{l}</span><b>{fmtDZD(v, lang)}</b>
        </div>
      ))}
    </div>
  );
}

export function PrintShell({ children }: { children: React.ReactNode }) {
  return <div className="print-page bg-white max-w-[210mm] mx-auto p-8 min-h-[200mm]">{children}</div>;
}
