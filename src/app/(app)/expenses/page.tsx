import ActionForm from '@/components/ActionForm';
import { q, num } from '@/lib/db';
import { getLang, fmtDZD } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import ExpenseForm from './ExpenseForm';
import { deleteExpense } from '@/lib/actions';

export default async function ExpensesPage() {
  const lang = await getLang();
  const rows = await q(`select e.*, c.name cat from expenses e left join expense_categories c on c.id=e.category_id order by e.expense_date desc`);
  const cats = await q('select * from expense_categories order by name');
  const total = (rows as Record<string, unknown>[]).reduce((s, r) => s + num(r.amount), 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1f3147]">{t('expenses', lang)}</h1>
        <ExpenseForm lang={lang} cats={cats as never} />
      </div>
      <div className="card"><div className="text-xs text-gray-500">{t('total', lang)}</div><div className="text-xl font-bold">{fmtDZD(total, lang)}</div></div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">{t('date', lang)}</th><th className="th">{t('category', lang)}</th><th className="th">{t('description', lang)}</th><th className="th">{t('payment_method', lang)}</th><th className="th">{t('amount', lang)}</th><th className="th"></th></tr></thead>
          <tbody>{(rows as Record<string, unknown>[]).map(e => (
            <tr key={e.id as string}>
              <td className="td">{String(e.expense_date).slice(0, 10)}</td>
              <td className="td">{e.cat as string ?? '—'}</td>
              <td className="td">{e.description as string ?? ''}</td>
              <td className="td text-xs">{e.payment_method as string}</td>
              <td className="td font-semibold">{fmtDZD(num(e.amount), lang)}</td>
              <td className="td"><ActionForm action={deleteExpense.bind(null, e.id as string)}><button className="text-red-500">×</button></ActionForm></td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
