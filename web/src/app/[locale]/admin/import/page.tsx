import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  clearAdminSession,
  createAdminSession,
  hasAdminImportPassword,
  isAdminAuthenticated,
} from '@/lib/admin-auth';
import { buildRecipeImportDraftFromUrl } from '@/lib/recipe-import';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ url?: string; auth?: string }>;
};

async function loginAction(formData: FormData) {
  'use server';

  const locale = String(formData.get('locale') ?? 'fr');
  const password = String(formData.get('password') ?? '');
  const isValid = await createAdminSession(password);

  if (!isValid) {
    redirect(`/${locale}/admin/import?auth=error`);
  }

  redirect(`/${locale}/admin/import`);
}

async function logoutAction(formData: FormData) {
  'use server';

  const locale = String(formData.get('locale') ?? 'fr');
  await clearAdminSession();
  redirect(`/${locale}/admin/import`);
}

function formatDuration(value: number | null): string {
  if (!value) return '—';
  return `${value} min`;
}

export default async function AdminImportPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { url, auth } = await searchParams;
  const t = await getTranslations('adminImport');
  const hasPassword = hasAdminImportPassword();
  const isAuthenticated = await isAdminAuthenticated();

  let draft = null;
  let previewError: string | null = null;

  if (hasPassword && isAuthenticated && url) {
    try {
      draft = await buildRecipeImportDraftFromUrl(url);
    } catch (error) {
      previewError = error instanceof Error ? error.message : t('preview.errorFallback');
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
              {t('eyebrow')}
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
                {t('title')}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-stone-600">{t('intro')}</p>
            </div>
          </div>

          {isAuthenticated && (
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
              >
                {t('logout')}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{t('principles.securityTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">{t('principles.securityBody')}</p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{t('principles.reviewTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">{t('principles.reviewBody')}</p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{t('principles.scopeTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">{t('principles.scopeBody')}</p>
          </div>
        </div>
      </section>

      {!hasPassword ? (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">{t('config.title')}</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900/80">{t('config.body')}</p>
          <code className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-xs text-amber-900">
            ADMIN_IMPORT_PASSWORD=...
          </code>
        </section>
      ) : !isAuthenticated ? (
        <section className="mx-auto max-w-md rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-stone-900">{t('login.title')}</h2>
            <p className="text-sm leading-6 text-stone-600">{t('login.body')}</p>
          </div>

          {auth === 'error' && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {t('login.error')}
            </p>
          )}

          <form action={loginAction} className="mt-5 space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">{t('login.passwordLabel')}</span>
              <input
                type="password"
                name="password"
                required
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400 focus:bg-white"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-2xl bg-orange-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-orange-800"
            >
              {t('login.submit')}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  {t('source.eyebrow')}
                </p>
                <h2 className="text-xl font-semibold text-stone-900">{t('source.title')}</h2>
                <p className="text-sm leading-6 text-stone-600">{t('source.body')}</p>
              </div>

              <form className="mt-5 space-y-4" method="get">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-stone-700">{t('source.urlLabel')}</span>
                  <input
                    type="url"
                    name="url"
                    defaultValue={url ?? ''}
                    required
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400 focus:bg-white"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
                >
                  {t('source.submit')}
                </button>
              </form>
            </div>

            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50/80 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                {t('photo.eyebrow')}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-stone-900">{t('photo.title')}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{t('photo.body')}</p>
              <div className="mt-5 inline-flex rounded-full bg-white px-3 py-1 text-xs text-stone-500">
                {t('photo.badge')}
              </div>
            </div>
          </section>

          {previewError && (
            <section className="rounded-[24px] border border-red-200 bg-red-50 p-6 text-sm leading-6 text-red-700">
              <strong>{t('preview.errorTitle')}</strong> {previewError}
            </section>
          )}

          {draft && (
            <section className="space-y-6 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                    {t('preview.eyebrow')}
                  </p>
                  <h2 className="text-2xl font-semibold text-stone-900">{draft.name ?? t('preview.untitled')}</h2>
                  <p className="text-sm text-stone-500">
                    {draft.sourceDomain} · <a href={draft.sourceUrl} className="underline underline-offset-4">{t('preview.openSource')}</a>
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
                  {t('preview.reviewReminder')}
                </div>
              </div>

              {draft.warnings.length > 0 && (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-medium text-amber-900">{t('preview.warningsTitle')}</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900/85">
                    {draft.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                  <section className="rounded-[24px] bg-stone-50 p-5">
                    <h3 className="text-sm font-semibold text-stone-900">{t('preview.summaryTitle')}</h3>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.author')}</dt>
                        <dd className="mt-1 text-sm text-stone-700">{draft.author ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.servings')}</dt>
                        <dd className="mt-1 text-sm text-stone-700">{draft.servings ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.prepTime')}</dt>
                        <dd className="mt-1 text-sm text-stone-700">{formatDuration(draft.prepTime)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.cookTime')}</dt>
                        <dd className="mt-1 text-sm text-stone-700">{formatDuration(draft.cookTime)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.totalTime')}</dt>
                        <dd className="mt-1 text-sm text-stone-700">{formatDuration(draft.totalTime)}</dd>
                      </div>
                    </dl>

                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.notes')}</p>
                      <p className="mt-2 text-sm leading-6 text-stone-700">{draft.notes ?? '—'}</p>
                    </div>
                  </section>

                  <section className="rounded-[24px] bg-stone-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-stone-900">{t('preview.ingredientsTitle')}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-500">
                        {draft.ingredients.length}
                      </span>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-700">
                      {draft.ingredients.length > 0 ? (
                        draft.ingredients.map((ingredient) => <li key={ingredient.text}>• {ingredient.text}</li>)
                      ) : (
                        <li className="text-stone-400">{t('preview.emptyIngredients')}</li>
                      )}
                    </ul>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-[24px] bg-stone-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-stone-900">{t('preview.stepsTitle')}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-500">
                        {draft.steps.length}
                      </span>
                    </div>
                    <ol className="mt-4 space-y-3">
                      {draft.steps.length > 0 ? (
                        draft.steps.map((step) => (
                          <li key={step.step} className="flex gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-stone-700">
                              {step.step}
                            </span>
                            <p className="text-sm leading-6 text-stone-700">{step.instruction}</p>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-stone-400">{t('preview.emptySteps')}</li>
                      )}
                    </ol>
                  </section>

                  <section className="rounded-[24px] border border-dashed border-stone-300 bg-white p-5">
                    <h3 className="text-sm font-semibold text-stone-900">{t('review.title')}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{t('review.body')}</p>
                    <button
                      type="button"
                      disabled
                      className="mt-5 w-full cursor-not-allowed rounded-2xl bg-stone-200 px-4 py-3 text-sm font-medium text-stone-500"
                    >
                      {t('review.cta')}
                    </button>
                  </section>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
