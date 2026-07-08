import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { hasAdminImportPassword } from '@/lib/admin-auth';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Sofra Cuisine',
  description: 'Mes recettes franco-turques, fitness et cocktails',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const messages = await getMessages();
  const t = await getTranslations('nav');
  const hasAdminImport = hasAdminImportPassword();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-stone-50 text-stone-800 font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
              <Link href="/" className="font-semibold text-lg text-orange-700 tracking-tight">
                Sofra
              </Link>
              <nav className="flex items-center gap-4">
                <Link
                  href="/recettes"
                  className="text-sm text-stone-600 hover:text-orange-700 transition-colors"
                >
                  Recettes
                </Link>
                {hasAdminImport && (
                  <Link
                    href="/admin/import"
                    className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-700"
                  >
                    {t('import')}
                  </Link>
                )}
              </nav>
            </div>
          </header>
          <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
