'use client';
import ActionForm from './ActionForm';
import { t, type Lang } from '@/lib/i18n';
import { Modal, useModal } from './ui';
import { saveProduct } from '@/lib/actions';

export type ProductRow = {
  id: string; reference: string; name: string; category_id: string | null; type: string;
  description: string | null; image_url: string | null; selling_price: number; min_stock: number;
};

export default function ProductForm({ lang, categories, product }: {
  lang: Lang; categories: { id: string; name: string }[]; product?: ProductRow;
}) {
  const [open, openM, closeM] = useModal();
  return (
    <>
      <button onClick={openM} className={product ? 'btn-ghost text-xs' : 'btn-primary'}>
        {product ? t('edit', lang) : `+ ${t('new_product', lang)}`}
      </button>
      <Modal open={open} onClose={closeM} title={t('new_product', lang)}>
        <ActionForm action={async fd => { await saveProduct(fd); closeM(); }} className="grid grid-cols-2 gap-3">
          {product && <input type="hidden" name="id" value={product.id} />}
          <input name="reference" required placeholder={t('reference', lang)} defaultValue={product?.reference} className="input" />
          <input name="name" required placeholder={t('name', lang)} defaultValue={product?.name} className="input" />
          <select name="category_id" defaultValue={product?.category_id ?? ''} className="input">
            <option value="">{t('category', lang)}…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select name="type" defaultValue={product?.type ?? 'resale'} className="input">
            {(['manufactured','assembled','resale','raw_material'] as const).map(ty => <option key={ty} value={ty}>{t(ty, lang)}</option>)}
          </select>
          <input name="selling_price" type="number" step="any" min="0" placeholder={t('selling_price', lang)} defaultValue={product?.selling_price} className="input" />
          <input name="min_stock" type="number" step="any" min="0" placeholder={t('min_stock', lang)} defaultValue={product?.min_stock} className="input" />
          <input name="image_url" placeholder="Image URL" defaultValue={product?.image_url ?? ''} className="input col-span-2" />
          <textarea name="description" placeholder={t('description', lang)} defaultValue={product?.description ?? ''} className="input col-span-2" />
          <button className="btn-primary col-span-2">{t('save', lang)}</button>
        </ActionForm>
      </Modal>
    </>
  );
}
