import recipesData from '@/data/recipes.json';

export type Ingredient = {
  name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
};

export type Step = {
  step: number;
  instruction: string;
  source: 'original' | 'suggested';
};

export type Recipe = {
  id: number;
  name: string;
  notes: string | null;
  cuisine_type: string | null;
  dish_type: string | null;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  source_url: string | null;
  source_file: string | null;
  country_code: string | null;
  rating: number | null;
  made_count: number;
  last_made: string | null;
  author: string | null;
  created_at: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  tags: Record<string, string[]>;
};

export const allRecipes = recipesData as unknown as Recipe[];

export function getRecipe(id: number): Recipe | undefined {
  return allRecipes.find((r) => r.id === id);
}

export function getCollection(recipe: Recipe): string | null {
  return recipe.tags?.collection?.[0] ?? null;
}

export function filterByCollection(collection: string): Recipe[] {
  return allRecipes.filter((r) => r.tags?.collection?.includes(collection));
}

export const COLLECTION_COLORS: Record<string, string> = {
  kiyma: 'bg-red-100 text-red-800',
  fitness: 'bg-green-100 text-green-800',
  cocktail: 'bg-purple-100 text-purple-800',
  ottolenghi: 'bg-teal-100 text-teal-800',
};

export const COLLECTION_LABELS: Record<string, string> = {
  kiyma: 'Kıyma',
  fitness: 'Fitness',
  cocktail: 'Cocktail',
  ottolenghi: 'Ottolenghi',
};

export function ratingStars(rating: number | null): string {
  if (!rating) return '';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}
