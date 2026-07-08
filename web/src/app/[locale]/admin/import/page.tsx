import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  clearAdminSession,
  createAdminSession,
  hasAdminImportPassword,
  isAdminAuthenticated,
} from '@/lib/admin-auth';
import { createRecipeFromReview } from '@/lib/admin-recipes';
import {
  buildRecipeImportDraftFromPhotoUpload,
  buildRecipeImportDraftFromUrl,
  buildRecipeReviewPayload,
} from '@/lib/recipe-import';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    url?: string;
    photo?: string;
    auth?: string;
    saved?: string;
    save?: string;
    photoError?: string;
  }>;
};

const MAX_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;

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

async function saveDraftAction(formData: FormData) {
  'use server';

  const locale = String(formData.get('locale') ?? 'fr');
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    redirect(`/${locale}/admin/import?auth=error`);
  }

  const payload = buildRecipeReviewPayload(formData);

  if (!payload.name) {
    redirect(`/${locale}/admin/import?save=error`);
  }

  const recipeId = await createRecipeFromReview(payload);
  redirect(`/${locale}/admin/import?saved=${recipeId}`);
}

async function importPhotoAction(formData: FormData) {
  'use server';

  const locale = String(formData.get('locale') ?? 'fr');
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    redirect(`/${locale}/admin/import?auth=error`);
  }

  const uploadedFile = formData.get('photo');

  if (!(uploadedFile instanceof File) || uploadedFile.size === 0) {
    redirect(`/${locale}/admin/import?photoError=missing`);
  }

  if (!uploadedFile.type.startsWith('image/')) {
    redirect(`/${locale}/admin/import?photoError=type`);
  }

  if (uploadedFile.size > MAX_PHOTO_UPLOAD_BYTES) {
    redirect(`/${locale}/admin/import?photoError=size`);
  }

  redirect(`/${locale}/admin/import?photo=${encodeURIComponent(uploadedFile.name)}`);
}

function getPhotoErrorMessage(photoError: string | undefined, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (photoError === 'missing') return t('photo.errorMissing');
  if (photoError === 'type') return t('photo.errorType');
  if (photoError === 'size') return t('photo.errorSize');
  return null;
}

export default async function AdminImportPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { url, photo, auth, saved, save, photoError } = await searchParams;
  const t = await getTranslations('adminImport');
  const hasPassword = hasAdminImportPassword();
  const isAuthenticated = await isAdminAuthenticated();

  let draft = null;
  let previewError: string | null = null;
  const photoErrorMessage = getPhotoErrorMessage(photoError, t);

  if (hasPassword && isAuthenticated && url) {
    try {
      draft = await buildRecipeImportDraftFromUrl(url);
    } catch (error) {
      previewError = error instanceof Error ? error.message : t('preview.errorFallback');
    }
  } else if (hasPassword && isAuthenticated && photo) {
    draft = buildRecipeImportDraftFromPhotoUpload(photo);
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
          {saved && (
            <section className="rounded-[24px] border border-teal-200 bg-teal-50 p-6 text-sm leading-6 text-teal-900">
              <strong>{t('saved.title')}</strong>{' '}
              {t('saved.body', {id: saved})}{' '}
              <Link href={`/recettes/${saved}`} className="underline underline-offset-4">
                {t('saved.open')}
              </Link>
            </section>
          )}

          {save === 'error' && (
            <section className="rounded-[24px] border border-red-200 bg-red-50 p-6 text-sm leading-6 text-red-700">
              <strong>{t('review.errorTitle')}</strong> {t('review.errorBody')}
            </section>
          )}

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
                <input type="hidden" name="saved" value="" />
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
              {photoErrorMessage && (
                <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {photoErrorMessage}
                </p>
              )}
              <form action={importPhotoAction} className="mt-5 space-y-4">
                <input type="hidden" name="locale" value={locale} />
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-stone-700">{t('photo.inputLabel')}</span>
                  <input
                    type="file"
                    name="photo"
                    accept="image/*"
                    required
                    className="block w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 file:mr-3 file:rounded-full file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                  />
                </label>
                <p className="text-xs leading-5 text-stone-500">{t('photo.help')}</p>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
                >
                  {t('photo.submit')}
                </button>
              </form>
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
                    {draft.sourceDomain ?? draft.sourceLabel}
                    {draft.sourceUrl && (
                      <>
                        {' · '}
                        <a href={draft.sourceUrl} className="underline underline-offset-4">
                          {t('preview.openSource')}
                        </a>
                      </>
                    )}
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
                <form action={saveDraftAction} className="contents">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="sourceFile" value={draft.sourceFile ?? ''} />
                  <div className="space-y-6">
                    <section className="rounded-[24px] bg-stone-50 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-stone-900">{t('preview.summaryTitle')}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-500">
                          {t('review.editableBadge')}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="block space-y-2 sm:col-span-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('review.fields.name')}</span>
                          <input name="name" defaultValue={draft.name ?? ''} required className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400" />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.author')}</span>
                          <input name="author" defaultValue={draft.author ?? ''} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400" />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.servings')}</span>
                          <input name="servings" type="number" min="1" defaultValue={draft.servings ?? ''} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400" />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.prepTime')}</span>
                          <input name="prepTime" type="number" min="0" defaultValue={draft.prepTime ?? ''} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400" />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.cookTime')}</span>
                          <input name="cookTime" type="number" min="0" defaultValue={draft.cookTime ?? ''} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400" />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('review.fields.cuisineType')}</span>
                          <input name="cuisineType" defaultValue="" placeholder="ottolenghi, francaise, turque..." className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400" />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('review.fields.dishType')}</span>
                          <input name="dishType" defaultValue="" placeholder="plat, entree, dessert..." className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400" />
                        </label>
                        <label className="block space-y-2 sm:col-span-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('review.fields.sourceUrl')}</span>
                          <input name="sourceUrl" defaultValue={draft.sourceUrl ?? ''} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400" />
                        </label>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-400">{t('preview.fields.notes')}</p>
                        <textarea name="notes" rows={5} defaultValue={draft.notes ?? ''} className="mt-2 w-full rounded-[24px] border border-stone-200 bg-white px-4 py-3 text-sm leading-6 text-stone-900 outline-none transition focus:border-orange-400" />
                      </div>
                    </section>

                    <section className="rounded-[24px] bg-stone-50 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-stone-900">{t('preview.ingredientsTitle')}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-500">
                          {draft.ingredients.length}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-stone-500">{t('review.ingredientsHelp')}</p>
                      <textarea
                        name="ingredientsText"
                        rows={Math.max(8, draft.ingredients.length + 2)}
                        defaultValue={draft.ingredients.map((ingredient) => ingredient.text).join('\n')}
                        className="mt-4 w-full rounded-[24px] border border-stone-200 bg-white px-4 py-3 text-sm leading-6 text-stone-900 outline-none transition focus:border-orange-400"
                      />
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
                      <p className="mt-2 text-xs leading-5 text-stone-500">{t('review.stepsHelp')}</p>
                      <textarea
                        name="stepsText"
                        rows={Math.max(10, draft.steps.length * 2)}
                        defaultValue={draft.steps.map((step) => step.instruction).join('\n')}
                        className="mt-4 w-full rounded-[24px] border border-stone-200 bg-white px-4 py-3 text-sm leading-6 text-stone-900 outline-none transition focus:border-orange-400"
                      />
                    </section>

                    <section className="rounded-[24px] border border-dashed border-stone-300 bg-white p-5">
                      <h3 className="text-sm font-semibold text-stone-900">{t('review.title')}</h3>
                      <p className="mt-2 text-sm leading-6 text-stone-600">{t('review.body')}</p>
                      <button
                        type="submit"
                        className="mt-5 w-full rounded-2xl bg-orange-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-orange-800"
                      >
                        {t('review.cta')}
                      </button>
                    </section>
                  </div>
                </form>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
