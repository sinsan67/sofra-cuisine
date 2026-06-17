import { sql } from './db';
import type { Recipe } from './recipes';

type RawRecipe = Omit<Recipe, 'ingredients' | 'steps' | 'tags'>;
type RawIngredient = { recipe_id: number; name: string; category: string | null; quantity: number | null; unit: string | null };
type RawStep = { recipe_id: number; step_number: number; instruction: string; source: 'original' | 'suggested' };
type RawTag = { recipe_id: number; tag_group: string; tag_value: string };

function assemble(
  raws: RawRecipe[],
  ings: RawIngredient[],
  steps: RawStep[],
  tags: RawTag[],
): Recipe[] {
  return raws.map((r) => {
    const tagsMap: Record<string, string[]> = {};
    for (const t of tags.filter((t) => t.recipe_id === r.id)) {
      (tagsMap[t.tag_group] ??= []).push(t.tag_value);
    }
    return {
      ...r,
      ingredients: ings
        .filter((i) => i.recipe_id === r.id)
        .map(({ name, category, quantity, unit }) => ({ name, category, quantity, unit })),
      steps: steps
        .filter((s) => s.recipe_id === r.id)
        .map(({ step_number, instruction, source }) => ({ step: step_number, instruction, source })),
      tags: tagsMap,
    };
  });
}

export async function getAllRecipes(): Promise<Recipe[]> {
  const [raws, ings, steps, tags] = await Promise.all([
    sql`
      SELECT id, name, notes, cuisine_type, dish_type, servings, prep_time, cook_time,
             source_url, source_file, country_code, rating, made_count, last_made, author, created_at
      FROM recipes
      ORDER BY name
    `,
    sql`
      SELECT ri.recipe_id, i.name, i.category, ri.quantity, ri.unit
      FROM recipe_ingredients ri
      JOIN ingredients i ON i.id = ri.ingredient_id
    `,
    sql`
      SELECT recipe_id, step_number, instruction, source
      FROM recipe_steps
      ORDER BY recipe_id, step_number
    `,
    sql`SELECT recipe_id, tag_group, tag_value FROM recipe_tags`,
  ]);

  return assemble(
    raws as unknown as RawRecipe[],
    ings as unknown as RawIngredient[],
    steps as unknown as RawStep[],
    tags as unknown as RawTag[],
  );
}

export async function getRecipeById(id: number): Promise<Recipe | undefined> {
  const [raws, ings, steps, tags] = await Promise.all([
    sql`
      SELECT id, name, notes, cuisine_type, dish_type, servings, prep_time, cook_time,
             source_url, source_file, country_code, rating, made_count, last_made, author, created_at
      FROM recipes WHERE id = ${id}
    `,
    sql`
      SELECT ri.recipe_id, i.name, i.category, ri.quantity, ri.unit
      FROM recipe_ingredients ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE ri.recipe_id = ${id}
    `,
    sql`
      SELECT recipe_id, step_number, instruction, source
      FROM recipe_steps WHERE recipe_id = ${id} ORDER BY step_number
    `,
    sql`SELECT recipe_id, tag_group, tag_value FROM recipe_tags WHERE recipe_id = ${id}`,
  ]);

  if (raws.length === 0) return undefined;

  return assemble(
    raws as unknown as RawRecipe[],
    ings as unknown as RawIngredient[],
    steps as unknown as RawStep[],
    tags as unknown as RawTag[],
  )[0];
}
