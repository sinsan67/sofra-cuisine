import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getRecipeById } from '@/lib/queries';
import {
  getCollection,
  COLLECTION_COLORS,
  COLLECTION_LABELS,
  ratingStars,
  type Ingredient,
} from '@/lib/recipes';

type Props = {
  params: Promise<{ locale: string; id: string }>;
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

type IngredientGroup = {
  key: string;
  label: string;
  items: Ingredient[];
};

function formatIngredientCategory(category: string | null): string {
  if (!category) return 'Autres';

  return category
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function groupIngredientsByCategory(ingredients: Ingredient[]): IngredientGroup[] {
  const groups = new Map<string, IngredientGroup>();

  for (const ingredient of ingredients) {
    const key = ingredient.category ?? 'autres';

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: formatIngredientCategory(ingredient.category),
        items: [],
      });
    }

    groups.get(key)?.items.push(ingredient);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === 'autres') return 1;
    if (b.key === 'autres') return -1;
    return a.label.localeCompare(b.label, 'fr');
  });
}

export default async function RecettePage({ params }: Props) {
  const { locale, id } = await params;
  const recipe = await getRecipeById(Number(id), locale);

  if (!recipe) notFound();

  const col = getCollection(recipe);
  const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);

  const originalSteps = recipe.steps.filter((s) => s.source === 'original');
  const suggestedSteps = recipe.steps.filter((s) => s.source === 'suggested');
  const ingredientGroups = groupIngredientsByCategory(recipe.ingredients);

  return (
    <div className="space-y-8">
      {/* Retour */}
      <Link href="/recettes" className="text-sm text-stone-400 hover:text-orange-700 transition-colors">
        ← Toutes les recettes
      </Link>

      {/* En-tête */}
      <div>
        <div className="flex items-start gap-3 mb-2">
          <h1 className="text-2xl font-bold text-stone-900 flex-1">{recipe.name}</h1>
          {col && (
            <span className={`shrink-0 mt-1 text-xs px-2 py-0.5 rounded-full ${COLLECTION_COLORS[col] ?? 'bg-stone-100 text-stone-600'}`}>
              {COLLECTION_LABELS[col] ?? col}
            </span>
          )}
        </div>

        {recipe.notes && (
          <p className="text-stone-500 text-sm leading-relaxed">{recipe.notes}</p>
        )}

        {/* Méta */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-stone-500">
          {recipe.dish_type && (
            <span>{DISH_TYPE_LABELS[recipe.dish_type] ?? recipe.dish_type}</span>
          )}
          {recipe.servings && <span>{recipe.servings} portions</span>}
          {recipe.prep_time && <span>Prép : {recipe.prep_time} min</span>}
          {recipe.cook_time && <span>Cuisson : {recipe.cook_time} min</span>}
          {totalTime > 0 && <span className="font-medium text-stone-700">Total : {totalTime} min</span>}
          {recipe.rating && (
            <span className="text-amber-500">{ratingStars(recipe.rating)}</span>
          )}
        </div>
      </div>

      {/* Ingrédients */}
      {recipe.ingredients.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
              Ingrédients
            </h2>
            <span className="text-[11px] text-stone-400 bg-stone-100 px-2 py-1 rounded-full">
              {recipe.ingredients.length} éléments
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {ingredientGroups.map((group) => (
              <section
                key={group.key}
                className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    {group.label}
                  </h3>
                  <span className="text-[11px] text-stone-400">
                    {group.items.length}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {group.items.map((ing, i) => (
                    <li
                      key={`${group.key}-${i}-${ing.name}`}
                      className="grid grid-cols-[auto,1fr] items-start gap-x-2 text-sm leading-snug"
                    >
                      <span className="min-w-0 text-stone-800 font-medium whitespace-nowrap">
                        {ing.quantity ? `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ''}` : '•'}
                      </span>
                      <span className="text-stone-600">
                        {ing.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      )}

      {/* Étapes originales */}
      {originalSteps.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Préparation
          </h2>
          <ol className="space-y-3">
            {originalSteps.map((step) => (
              <li key={step.step} className="flex gap-3 text-sm">
                <span className="shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-semibold text-xs flex items-center justify-center mt-0.5">
                  {step.step}
                </span>
                <p className="text-stone-700 leading-relaxed">{step.instruction}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Étapes suggérées */}
      {suggestedSteps.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Conseils &amp; suggestions
          </h2>
          <ol className="space-y-3">
            {suggestedSteps.map((step) => (
              <li key={step.step} className="flex gap-3 text-sm">
                <span className="shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 font-semibold text-xs flex items-center justify-center mt-0.5">
                  {step.step}
                </span>
                <p className="text-stone-600 leading-relaxed">{step.instruction}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Tags */}
      {Object.keys(recipe.tags).length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(recipe.tags).flatMap(([group, values]) =>
              values.map((val) => (
                <span
                  key={`${group}-${val}`}
                  className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full"
                >
                  {val}
                </span>
              ))
            )}
          </div>
        </section>
      )}

      {/* Historique */}
      {(recipe.made_count > 0 || recipe.last_made) && (
        <section className="text-xs text-stone-400 border-t border-stone-100 pt-4">
          {recipe.made_count > 0 && <span>Réalisée {recipe.made_count} fois</span>}
          {recipe.last_made && <span> · Dernière fois : {recipe.last_made}</span>}
        </section>
      )}
    </div>
  );
}
