import { Link } from '@/i18n/navigation';
import { getAllRecipes } from '@/lib/queries';
import {
  COLLECTION_COLORS,
  COLLECTION_LABELS,
  getCollection,
  ratingStars,
} from '@/lib/recipes';

type Props = {
  searchParams: Promise<{ collection?: string; q?: string }>;
};

const DISH_TYPE_LABELS: Record<string, string> = {
  plat: 'Plat',
  entrée: 'Entrée',
  dessert: 'Dessert',
  snack: 'Snack',
  sauce: 'Sauce',
  accompagnement: 'Accompagnement',
  cocktail: 'Cocktail',
};

export default async function RecettesPage({ searchParams }: Props) {
  const { collection, q } = await searchParams;

  let recipes = await getAllRecipes();

  if (collection) {
    recipes = recipes.filter((r) => r.tags?.collection?.includes(collection));
  }

  if (q) {
    const query = q.toLowerCase();
    recipes = recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.cuisine_type?.toLowerCase().includes(query) ||
        r.dish_type?.toLowerCase().includes(query)
    );
  }

  const collections = ['kiyma', 'fitness', 'cocktail', 'ottolenghi'] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Recettes</h1>
        <span className="text-sm text-stone-500">{recipes.length} résultat{recipes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filtres collections */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/recettes"
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !collection
              ? 'bg-orange-700 text-white border-orange-700'
              : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'
          }`}
        >
          Tout
        </Link>
        {collections.map((col) => (
          <Link
            key={col}
            href={`/recettes?collection=${col}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              collection === col
                ? 'bg-orange-700 text-white border-orange-700'
                : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'
            }`}
          >
            {COLLECTION_LABELS[col]}
          </Link>
        ))}
      </div>

      {/* Liste */}
      {recipes.length === 0 ? (
        <p className="text-stone-400 py-8 text-center">Aucune recette trouvée.</p>
      ) : (
        <div className="space-y-2">
          {recipes.map((recipe) => {
            const col = getCollection(recipe);
            return (
              <Link
                key={recipe.id}
                href={`/recettes/${recipe.id}`}
                className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 px-4 py-3.5 hover:border-orange-300 hover:shadow-sm transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-800 group-hover:text-orange-700 transition-colors truncate">
                    {recipe.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {recipe.dish_type && (
                      <span className="text-xs text-stone-400">
                        {DISH_TYPE_LABELS[recipe.dish_type] ?? recipe.dish_type}
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="text-xs text-stone-400">· {recipe.servings} pers.</span>
                    )}
                    {recipe.rating && (
                      <span className="text-xs text-amber-500">{ratingStars(recipe.rating)}</span>
                    )}
                  </div>
                </div>
                {col && (
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${COLLECTION_COLORS[col] ?? 'bg-stone-100 text-stone-600'}`}
                  >
                    {COLLECTION_LABELS[col] ?? col}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
