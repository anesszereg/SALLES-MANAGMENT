'use client';
import ActionForm from './ActionForm';
import { useState } from 'react';
import { t, type Lang } from '@/lib/i18n';

export type Party = { id: string; name: string };
export type Prod = { id: string; name: string; reference: string; selling_price: number; stock: number };
type Line = { product_id: string; quantity: number; unit_price: number };

export default function InvoiceForm({ mode, lang, parties, products, action }: {
  mode: 'sale' | 'purchase';
  lang: Lang;
  parties: Party[];
  products: Prod[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: 1, unit_price: 0 }]);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const set = (i: number, k: keyof Line, v: string) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, [k]: k === 'product_id' ? v : Number(v) } : l)));

  return (
    <ActionForm action={async fd => { fd.set('items', JSON.stringify(lines.filter(l => l.product_id && l.quantity > 0))); await action(fd); }}
      className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <select name={mode === 'sale' ? 'customer_id' : 'supplier_id'} className="input" required>
          <option value="">{t(mode === 'sale' ? 'customer' : 'supplier', lang)}…</option>
          {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input name={mode === 'sale' ? 'sale_date' : 'purchase_date'} type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      {mode === 'purchase' && (
        <select name="category" className="input">
          {['raw_materials','accessories','ready_made','resale','other'].map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      )}
      <table className="w-full">
        <thead><tr><th className="th">{t('product', lang)}</th><th className="th w-20">{t('quantity', lang)}</th><th className="th w-28">{t('price', lang)}</th><th className="th w-24">{t('total', lang)}</th><th className="th w-8"></th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="py-1">
                <select className="input" value={l.product_id} required onChange={e => {
                  set(i, 'product_id', e.target.value);
                  if (mode === 'sale') { const p = products.find(p => p.id === e.target.value); if (p) set(i, 'unit_price', String(p.selling_price)); }
                }}>
                  <option value="">—</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.reference} · {p.name} ({p.stock})</option>)}
                </select>
              </td>
              <td><input type="number" min="0.01" step="any" className="input" value={l.quantity} onChange={e => set(i, 'quantity', e.target.value)} /></td>
              <td><input type="number" min="0" step="any" className="input" value={l.unit_price} onChange={e => set(i, 'unit_price', e.target.value)} /></td>
              <td className="text-sm px-2">{(l.quantity * l.unit_price).toFixed(2)}</td>
              <td><button type="button" className="text-red-500" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn-ghost text-xs" onClick={() => setLines(ls => [...ls, { product_id: '', quantity: 1, unit_price: 0 }])}>+ {t('add_item', lang)}</button>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label className="text-xs text-gray-500">{t('subtotal', lang)}</label><div className="font-bold">{subtotal.toFixed(2)}</div></div>
        {mode === 'sale'
          ? <div><label className="text-xs text-gray-500">{t('discount', lang)}</label><input name="discount" type="number" min="0" step="any" defaultValue={0} className="input" /></div>
          : <div><label className="text-xs text-gray-500">{t('extra_costs', lang)}</label><input name="extra_costs" type="number" min="0" step="any" defaultValue={0} className="input" /></div>}
        <div><label className="text-xs text-gray-500">{t('paid', lang)}</label><input name="amount_paid" type="number" min="0" step="any" defaultValue={0} className="input" /></div>
        <div><label className="text-xs text-gray-500">{t('payment_method', lang)}</label>
          <select name="payment_method" className="input"><option value="cash">{t('cash', lang)}</option><option value="bank">{t('bank', lang)}</option><option value="credit">—</option></select></div>
      </div>
      <input name="notes" placeholder={t('notes', lang)} className="input" />
      <button className="btn-primary w-full">{t('save', lang)}</button>
    </ActionForm>
  );
}
