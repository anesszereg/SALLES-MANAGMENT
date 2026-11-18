'use client';
import ActionForm from '@/components/ActionForm';
import { useState } from 'react';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from '@/components/ui';
import { saveRecipe } from '@/lib/actions';

type P = { id: string; name: string; reference: string };
type Line = { material_id: string; quantity: number };

export default function RecipeForm({ lang, products, materials }: { lang: Lang; products: P[]; materials: P[] }) {
  const [open, openM, closeM] = useModal();
  const [lines, setLines] = useState<Line[]>([{ material_id: '', quantity: 1 }]);
  return (
    <>
      <button onClick={openM} className="btn-ghost text-xs">+ {t('new_recipe', lang)}</button>
      <Modal open={open} onClose={closeM} title={t('new_recipe', lang)} wide>
        <ActionForm action={async fd => { fd.set('items', JSON.stringify(lines.filter(l => l.material_id && l.quantity > 0))); await saveRecipe(fd); closeM(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="name" required placeholder={t('name', lang)} className="input" />
            <select name="product_id" required className="input">
              <option value="">{t('product', lang)}…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.reference} · {p.name}</option>)}
            </select>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">{t('materials', lang)}</th><th className="th w-24">{t('quantity', lang)}</th><th className="th w-8"></th></tr></thead>
            <tbody>{lines.map((l, i) => (
              <tr key={i}>
                <td className="py-1"><select className="input" value={l.material_id} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, material_id: e.target.value } : x))}>
                  <option value="">—</option>{materials.map(m => <option key={m.id} value={m.id}>{m.reference} · {m.name}</option>)}
                </select></td>
                <td><input type="number" step="any" min="0" className="input" value={l.quantity} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} /></td>
                <td><button type="button" className="text-red-500" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>×</button></td>
              </tr>))}
            </tbody>
          </table>
          <button type="button" className="btn-ghost text-xs" onClick={() => setLines(ls => [...ls, { material_id: '', quantity: 1 }])}>+ {t('add_item', lang)}</button>
          <input name="notes" placeholder={t('notes', lang)} className="input" />
          <button className="btn-primary w-full">{t('save', lang)}</button>
        </ActionForm>
      </Modal>
    </>
  );
}
