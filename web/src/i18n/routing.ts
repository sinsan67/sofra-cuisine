import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'tr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
});
