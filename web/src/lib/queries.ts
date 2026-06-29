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

export async function getAllRecipes(locale = 'fr'): Promise<Recipe[]> {
  const [raws, ings, steps, tags] = await Promise.all([
    sql`
      SELECT
        r.id,
        COALESCE(rt.name, r.name) AS name,
        COALESCE(rt.notes, r.notes) AS notes,
        r.cuisine_type,
        r.dish_type,
        r.servings,
        r.prep_time,
        r.cook_time,
        r.source_url,
        r.source_file,
        r.country_code,
        r.rating,
        r.made_count,
        r.last_made,
        r.author,
        r.created_at
      FROM recipes r
      LEFT JOIN recipe_translations rt
        ON rt.recipe_id = r.id AND rt.locale = ${locale}
      ORDER BY name
    `,
    sql`
      SELECT
        ri.recipe_id,
        COALESCE(it.name, i.name) AS name,
        i.category,
        ri.quantity,
        ri.unit
      FROM recipe_ingredients ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      LEFT JOIN ingredient_translations it
        ON it.ingredient_id = i.id AND it.locale = ${locale}
    `,
    sql`
      SELECT
        rs.recipe_id,
        rs.step_number,
        COALESCE(rst.instruction, rs.instruction) AS instruction,
        rs.source
      FROM recipe_steps rs
      LEFT JOIN recipe_step_translations rst
        ON rst.recipe_step_id = rs.id AND rst.locale = ${locale}
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

export async function getRecipeById(id: number, locale = 'fr'): Promise<Recipe | undefined> {
  const [raws, ings, steps, tags] = await Promise.all([
    sql`
      SELECT
        r.id,
        COALESCE(rt.name, r.name) AS name,
        COALESCE(rt.notes, r.notes) AS notes,
        r.cuisine_type,
        r.dish_type,
        r.servings,
        r.prep_time,
        r.cook_time,
        r.source_url,
        r.source_file,
        r.country_code,
        r.rating,
        r.made_count,
        r.last_made,
        r.author,
        r.created_at
      FROM recipes r
      LEFT JOIN recipe_translations rt
        ON rt.recipe_id = r.id AND rt.locale = ${locale}
      WHERE r.id = ${id}
    `,
    sql`
      SELECT
        ri.recipe_id,
        COALESCE(it.name, i.name) AS name,
        i.category,
        ri.quantity,
        ri.unit
      FROM recipe_ingredients ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      LEFT JOIN ingredient_translations it
        ON it.ingredient_id = i.id AND it.locale = ${locale}
      WHERE ri.recipe_id = ${id}
    `,
    sql`
      SELECT
        rs.recipe_id,
        rs.step_number,
        COALESCE(rst.instruction, rs.instruction) AS instruction,
        rs.source
      FROM recipe_steps rs
      LEFT JOIN recipe_step_translations rst
        ON rst.recipe_step_id = rs.id AND rst.locale = ${locale}
      WHERE rs.recipe_id = ${id}
      ORDER BY step_number
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
