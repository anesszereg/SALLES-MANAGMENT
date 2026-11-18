import { q, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import AdjustForm from './AdjustForm';

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const lang = await getLang();
  const sp = await searchParams;
  const tab = sp.tab ?? 'stock';
  const products = await q(`select p.*, c.name cat from products p left join categories c on c.id=p.category_id order by p.type, p.name`);
  const movements = await q(
    `select sm.*, p.name product, p.reference from stock_movements sm join products p on p.id=sm.product_id order by sm.created_at desc limit 200`);
  const groups: Record<string, string> = { raw_material: 'raw_material', resale: 'resale', assembled: 'assembled', manufactured: 'manufactured' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('inventory', lang)}</h1>
        <div className="flex gap-2">
          <a href="?tab=stock" className={`btn text-xs ${tab === 'stock' ? 'bg-[#1f3147] text-white' : 'border bg-white'}`}>{t('stock', lang)}</a>
          <a href="?tab=movements" className={`btn text-xs ${tab === 'movements' ? 'bg-[#1f3147] text-white' : 'border bg-white'}`}>{t('stock_movements', lang)}</a>
          <AdjustForm lang={lang} products={products as never} />
        </div>
      </div>
      {tab === 'stock' ? (
        <div className="space-y-4">
          {Object.entries(groups).map(([type]) => {
            const rows = (products as Record<string, unknown>[]).filter(p => p.type === type);
            if (!rows.length) return null;
            const val = rows.reduce((s, p) => s + num(p.stock) * num(p.avg_cost), 0);
            return (
              <div key={type} className="card p-0 overflow-x-auto">
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b">
                  <h3 className="font-semibold">{t(type, lang)}</h3>
                  <span className="text-sm text-gray-500">{t('value', lang)}: <b>{fmtDZD(val, lang)}</b></span>
                </div>
                <table className="w-full">
                  <thead><tr><th className="th">{t('reference', lang)}</th><th className="th">{t('name', lang)}</th><th className="th">{t('stock', lang)}</th><th className="th">{t('avg_cost', lang)}</th><th className="th">{t('value', lang)}</th></tr></thead>
                  <tbody>{rows.map(p => (
                    <tr key={p.id as string} className={num(p.stock) <= num(p.min_stock) ? 'bg-red-50' : ''}>
                      <td className="td font-mono text-xs">{p.reference as string}</td><td className="td">{p.name as string}</td>
                      <td className="td font-semibold">{num(p.stock)}</td>
                      <td className="td">{fmtDZD(num(p.avg_cost), lang)}</td>
                      <td className="td">{fmtDZD(num(p.stock) * num(p.avg_cost), lang)}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">{t('date', lang)}</th><th className="th">{t('product', lang)}</th><th className="th">{t('type', lang)}</th><th className="th">{t('quantity', lang)}</th><th className="th">{t('unit_cost', lang)}</th><th className="th">{t('notes', lang)}</th></tr></thead>
            <tbody>{(movements as Record<string, unknown>[]).map(m => (
              <tr key={m.id as string}>
                <td className="td text-xs">{new Date(m.created_at as string).toLocaleString('fr-DZ')}</td>
                <td className="td">{m.reference as string} · {m.product as string}</td>
                <td className="td text-xs">{m.movement_type as string}</td>
                <td className={`td font-semibold ${num(m.quantity) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{num(m.quantity)}</td>
                <td className="td">{fmtDZD(num(m.unit_cost), lang)}</td>
                <td className="td text-xs text-gray-500">{m.note as string ?? ''}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
