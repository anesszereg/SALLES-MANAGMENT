import { loginAction } from '@/lib/actions';
import { getLang, isAuthed } from '@/lib/helpers';
import { t } from '@/lib/i18n';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  if (await isAuthed()) redirect('/');
  const lang = await getLang();
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1f3147]">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-bold text-[#1f3147] mb-1">{t('app_name', lang)}</h1>
        <p className="text-sm text-gray-500 mb-4">{t('login', lang)}</p>
        <LoginForm action={loginAction} lang={lang} />
      </div>
    </div>
  );
}
