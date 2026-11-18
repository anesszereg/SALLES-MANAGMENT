'use client';
import ActionForm, { notify } from '@/components/ActionForm';
import { useState } from 'react';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from '@/components/ui';
import { createBatch, getRecipeItems } from '@/lib/actions';

type P = { id: string; name: string; reference: string };
type R = { id: string; name: string; product_id: string };
type Line = { material_id: string; quantity: number };

export default function BatchForm({ lang, products, materials, recipes }: {
  lang: Lang; products: P[]; materials: (P & { avg_cost: number; stock: number })[]; recipes: R[];
}) {
  const [open, openM, closeM] = useModal();
  const [lines, setLines] = useState<Line[]>([{ material_id: '', quantity: 1 }]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const est = lines.reduce((s, l) => s + l.quantity * Number(materials.find(m => m.id === l.material_id)?.avg_cost ?? 0), 0);

  const applyRecipe = async (rid: string, newQty = qty) => {
    if (!rid) return;
    const r = recipes.find(x => x.id === rid);
    if (r) setProductId(r.product_id);
    try {
      const items = await getRecipeItems(rid) as { material_id: string; quantity: number }[];
      setLines(items.map(i => ({ material_id: i.material_id, quantity: Number(i.quantity) * newQty })));
    } catch {
      notify(lang === 'ar' ? 'تعذر تحميل الوصفة' : lang === 'fr' ? 'Impossible de charger la recette' : 'Unable to load recipe', 'error');
    }
  };

  return (
    <>
      <button onClick={openM} className="btn-primary text-xs">+ {t('new_batch', lang)}</button>
      <Modal open={open} onClose={closeM} title={t('new_batch', lang)} wide>
        <ActionForm action={async fd => {
          fd.set('items', JSON.stringify(lines.filter(l => l.material_id && l.quantity > 0)));
          fd.set('quantity', String(qty));
          await createBatch(fd); closeM();
        }} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select name="recipe_id" className="input" onChange={e => applyRecipe(e.target.value)}>
              <option value="">{t('recipe', lang)}…</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select name="product_id" required className="input" value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">{t('product', lang)}…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.reference} · {p.name}</option>)}
            </select>
            <input type="number" min="1" step="any" className="input" placeholder={t('quantity_to_produce', lang)} value={qty}
              onChange={e => { const v = Number(e.target.value); setQty(v); }} />
          </div>
          <table className="w-full">
            <thead><tr><th className="th">{t('materials', lang)}</th><th className="th w-24">{t('stock', lang)}</th><th className="th w-24">{t('quantity', lang)}</th><th className="th w-24">{t('total_cost', lang)}</th><th className="th w-8"></th></tr></thead>
            <tbody>{lines.map((l, i) => {
              const m = materials.find(x => x.id === l.material_id);
              return (
                <tr key={i}>
                  <td className="py-1"><select className="input" value={l.material_id} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, material_id: e.target.value } : x))}>
                    <option value="">—</option>{materials.map(mm => <option key={mm.id} value={mm.id}>{mm.reference} · {mm.name}</option>)}
                  </select></td>
                  <td className="td text-xs">{m?.stock ?? ''}</td>
                  <td><input type="number" step="any" min="0" className="input" value={l.quantity} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} /></td>
                  <td className="td text-xs">{(l.quantity * Number(m?.avg_cost ?? 0)).toFixed(2)}</td>
                  <td><button type="button" className="text-red-500" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>×</button></td>
                </tr>);
            })}
            </tbody>
          </table>
          <button type="button" className="btn-ghost text-xs" onClick={() => setLines(ls => [...ls, { material_id: '', quantity: 1 }])}>+ {t('add_item', lang)}</button>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-xs text-gray-500">{t('material_cost', lang)}</label><div className="font-bold">{est.toFixed(2)}</div></div>
            <div><label className="text-xs text-gray-500">{t('labor_cost', lang)}</label><input name="labor_cost" type="number" min="0" step="any" defaultValue={0} className="input" /></div>
            <div><label className="text-xs text-gray-500">{t('transport_cost', lang)}</label><input name="transport_cost" type="number" min="0" step="any" defaultValue={0} className="input" /></div>
            <div><label className="text-xs text-gray-500">{t('other_cost', lang)}</label><input name="other_cost" type="number" min="0" step="any" defaultValue={0} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="start_date" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
            <input name="notes" placeholder={t('notes', lang)} className="input" />
          </div>
          <button className="btn-primary w-full">{t('complete', lang)}</button>
        </ActionForm>
      </Modal>
    </>
  );
}
