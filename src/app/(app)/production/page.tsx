import { q, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import RecipeForm from './RecipeForm';
import BatchForm from './BatchForm';

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const lang = await getLang();
  const sp = await searchParams;
  const tab = sp.tab ?? 'batches';
  const recipes = await q(`select r.*, p.name product, p.reference,
      coalesce((select sum(ri.quantity * m.avg_cost) from production_recipe_items ri join products m on m.id=ri.material_id),0) est_cost
    from production_recipes r join products p on p.id=r.product_id order by r.created_at desc`);
  const batches = await q(`select b.*, p.name product, p.reference from production_batches b join products p on p.id=b.product_id order by b.created_at desc`);
  const finished = await q(`select id,name,reference from products where type in ('manufactured','assembled') order by name`);
  const materials = await q(`select id,name,reference,avg_cost,stock from products where type='raw_material' order by name`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('production', lang)}</h1>
        <div className="flex gap-2">
          <a href="?tab=batches" className={`btn text-xs ${tab === 'batches' ? 'bg-[#1f3147] text-white' : 'border bg-white'}`}>{t('batches', lang)}</a>
          <a href="?tab=recipes" className={`btn text-xs ${tab === 'recipes' ? 'bg-[#1f3147] text-white' : 'border bg-white'}`}>{t('recipes', lang)}</a>
          <RecipeForm lang={lang} products={finished as never} materials={materials as never} />
          <BatchForm lang={lang} products={finished as never} materials={materials as never} recipes={recipes as never} />
        </div>
      </div>
      {tab === 'recipes' ? (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">{t('name', lang)}</th><th className="th">{t('product', lang)}</th><th className="th">{t('estimated_cost', lang)}</th><th className="th">{t('notes', lang)}</th></tr></thead>
            <tbody>{(recipes as Record<string, unknown>[]).map(r => (
              <tr key={r.id as string}>
                <td className="td font-medium">{r.name as string}</td>
                <td className="td">{r.reference as string} · {r.product as string}</td>
                <td className="td">{fmtDZD(num(r.est_cost), lang)}</td>
                <td className="td text-xs text-gray-500">{r.notes as string ?? ''}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <th className="th">{t('batch', lang)}</th><th className="th">{t('product', lang)}</th><th className="th">{t('quantity', lang)}</th>
              <th className="th">{t('material_cost', lang)}</th><th className="th">{t('labor_cost', lang)}</th><th className="th">{t('other_cost', lang)}</th>
              <th className="th">{t('total_cost', lang)}</th><th className="th">{t('unit_cost', lang)}</th><th className="th">{t('status', lang)}</th><th className="th"></th>
            </tr></thead>
            <tbody>{(batches as Record<string, unknown>[]).map(b => (
              <tr key={b.id as string}>
                <td className="td font-mono text-xs">{b.batch_number as string}</td>
                <td className="td">{b.reference as string} · {b.product as string}</td>
                <td className="td">{num(b.quantity_completed)}</td>
                <td className="td">{fmtDZD(num(b.material_cost), lang)}</td>
                <td className="td">{fmtDZD(num(b.labor_cost), lang)}</td>
                <td className="td">{fmtDZD(num(b.transport_cost) + num(b.other_cost), lang)}</td>
                <td className="td font-semibold">{fmtDZD(num(b.total_cost), lang)}</td>
                <td className="td">{fmtDZD(num(b.unit_cost), lang)}</td>
                <td className="td text-xs">{t(b.status as string, lang)}</td>
                <td className="td"><a className="btn-ghost text-xs" href={`/print/batch/${b.id}`}>{t('print', lang)}</a></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
