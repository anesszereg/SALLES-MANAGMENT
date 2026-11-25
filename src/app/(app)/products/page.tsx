import ActionForm from '@/components/ActionForm';
import { q, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import ProductForm, { type ProductRow } from '@/components/ProductForm';
import CategoryForm from './CategoryForm';
import { deleteProduct } from '@/lib/actions';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ s?: string; type?: string }> }) {
  const lang = await getLang();
  const sp = await searchParams;
  const [products, categories] = await Promise.all([
    q(
      `select p.*, c.name cat from products p left join categories c on c.id=p.category_id
       where ($1='' or p.name ilike '%'||$1||'%' or p.reference ilike '%'||$1||'%')
         and ($2='' or p.type=$2) order by p.created_at desc`,
      [sp.s ?? '', sp.type ?? '']),
    q('select * from categories order by name'),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('products', lang)}</h1>
        <div className="flex gap-2"><CategoryForm lang={lang} /><ProductForm lang={lang} categories={categories as never} /></div>
      </div>
      <form className="flex gap-2">
        <input name="s" defaultValue={sp.s} placeholder={t('search', lang)} className="input max-w-xs" />
        <select name="type" defaultValue={sp.type ?? ''} className="input w-auto">
          <option value="">{t('type', lang)}</option>
          {['manufactured','assembled','resale','raw_material'].map(ty => <option key={ty} value={ty}>{t(ty, lang)}</option>)}
        </select>
        <button className="btn-ghost">{t('search', lang)}</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr>
            <th className="th">{t('reference', lang)}</th><th className="th">{t('name', lang)}</th><th className="th">{t('category', lang)}</th>
            <th className="th">{t('type', lang)}</th><th className="th">{t('stock', lang)}</th><th className="th">{t('avg_cost', lang)}</th>
            <th className="th">{t('selling_price', lang)}</th><th className="th">{t('value', lang)}</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {(products as never[]).map((p: Record<string, unknown> & ProductRow & { cat: string | null }) => (
              <tr key={p.id} className={num(p.stock) <= num(p.min_stock) ? 'bg-red-50' : ''}>
                <td className="td font-mono text-xs">{p.reference}</td>
                <td className="td font-medium">{p.name}{num(p.stock) <= num(p.min_stock) && <span className="ms-2 text-xs text-red-600">{t('low_stock', lang)}</span>}</td>
                <td className="td">{p.cat ?? '—'}</td>
                <td className="td">{t(p.type, lang)}</td>
                <td className="td">{num(p.stock)}</td>
                <td className="td">{fmtDZD(num(p.avg_cost), lang)}</td>
                <td className="td">{fmtDZD(num(p.selling_price), lang)}</td>
                <td className="td">{fmtDZD(num(p.stock) * num(p.avg_cost), lang)}</td>
                <td className="td flex gap-1">
                  <ProductForm lang={lang} categories={categories as never} product={p} />
                  <ActionForm action={deleteProduct.bind(null, p.id)}><button className="btn-ghost text-xs text-red-600">×</button></ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
