import type { Metadata } from 'next';
import './globals.css';
import ToastProvider from '@/components/ToastProvider';
import { getLang } from '@/lib/helpers';

export const metadata: Metadata = { title: 'Lune Benif ERP' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <body className="bg-gray-100 text-gray-900 antialiased">{children}<ToastProvider /></body>
    </html>
  );
}
