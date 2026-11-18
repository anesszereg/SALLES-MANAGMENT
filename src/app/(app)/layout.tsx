import { getLang, isAuthed } from '@/lib/helpers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getSetting } from '@/lib/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect('/login');
  const lang = await getLang();
  const business = await getSetting('business_name');
  return (
    <div className="flex min-h-screen">
      <Sidebar lang={lang} business={business} />
      <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full">{children}</main>
    </div>
  );
}
