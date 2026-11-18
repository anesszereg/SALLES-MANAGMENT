import ActionForm from '@/components/ActionForm';
import { q } from '@/lib/db';
import { getLang } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import { saveSettings, setLangAction } from '@/lib/actions';

export default async function SettingsPage() {
  const lang = await getLang();
  const rows = await q('select key,value from business_settings');
  const get = (k: string) => String((rows as { key: string; value: string }[]).find(r => r.key === k)?.value ?? '');
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold text-[#1f3147]">{t('settings', lang)}</h1>
      <div className="card">
        <h3 className="font-semibold mb-3">{t('business_name', lang)}</h3>
        <ActionForm action={saveSettings} className="space-y-3">
          <input name="business_name" defaultValue={get('business_name')} placeholder={t('business_name', lang)} className="input" />
          <input name="phone" defaultValue={get('phone')} placeholder={t('phone', lang)} className="input" />
          <input name="address" defaultValue={get('address')} placeholder={t('address', lang)} className="input" />
          <input name="logo_url" defaultValue={get('logo_url')} placeholder="Logo URL" className="input" />
          <button className="btn-primary">{t('save', lang)}</button>
        </ActionForm>
      </div>
      <div className="card">
        <h3 className="font-semibold mb-3">{t('language', lang)}</h3>
        <div className="flex gap-2">
          {(['ar', 'fr', 'en'] as const).map(l => (
            <ActionForm key={l} action={setLangAction.bind(null, l)}>
              <button className={`btn ${lang === l ? 'bg-[#1f3147] text-white' : 'border'}`}>{l === 'ar' ? 'العربية' : l === 'fr' ? 'Français' : 'English'}</button>
            </ActionForm>
          ))}
        </div>
      </div>
      <div className="card text-sm text-gray-500">
        <p>Password: set <code>ADMIN_PASSWORD</code> env var (default: <code>admin123</code>). Data dir: <code>./pgdata</code> (embedded Postgres — run <code>src/lib/schema.sql</code> on Supabase to migrate).</p>
      </div>
    </div>
  );
}
