import { Link } from '@/i18n/navigation';
import { getAllRecipes } from '@/lib/queries';
import { COLLECTION_COLORS, COLLECTION_LABELS, getCollection } from '@/lib/recipes';

export const dynamic = 'force-dynamic';

const collections = ['kiyma', 'fitness', 'cocktail', 'ottolenghi'] as const;

export default async function HomePage() {
  const allRecipes = await getAllRecipes();
  const totalRecipes = allRecipes.length;

  function collectionCount(col: string) {
    return allRecipes.filter((r) => r.tags?.collection?.includes(col)).length;
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-stone-900 mb-1">Sofra Cuisine</h1>
        <p className="text-stone-500 text-lg">
          {totalRecipes} recettes · franco-turques, fitness &amp; cocktails
        </p>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">
          Collections
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {collections.map((col) => (
            <Link
              key={col}
              href={`/recettes?collection=${col}`}
              className="bg-white rounded-xl border border-stone-200 p-4 hover:border-orange-300 hover:shadow-sm transition-all group"
            >
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${COLLECTION_COLORS[col]}`}
              >
                {COLLECTION_LABELS[col]}
              </span>
              <div className="text-stone-700 font-medium group-hover:text-orange-700 transition-colors">
                {collectionCount(col)} recette{collectionCount(col) > 1 ? 's' : ''}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            Toutes les recettes
          </h2>
          <Link href="/recettes" className="text-sm text-orange-700 hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="space-y-2">
          {allRecipes.slice(0, 5).map((recipe) => {
            const col = getCollection(recipe);
            return (
              <Link
                key={recipe.id}
                href={`/recettes/${recipe.id}`}
                className="flex items-center justify-between bg-white rounded-lg border border-stone-200 px-4 py-3 hover:border-orange-300 hover:shadow-sm transition-all"
              >
                <span className="font-medium text-stone-800">{recipe.name}</span>
                {col && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${COLLECTION_COLORS[col] ?? 'bg-stone-100 text-stone-600'}`}
                  >
                    {COLLECTION_LABELS[col] ?? col}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
