import { sql } from './db';
import type { RecipeReviewPayload } from './recipe-import';

type InsertRecipeRow = { id: number };
type InsertIngredientRow = { id: number };

async function getOrCreateIngredientId(name: string): Promise<number> {
  const existing = await sql`
    SELECT id
    FROM ingredients
    WHERE lower(name) = lower(${name})
    LIMIT 1
  ` as unknown as InsertIngredientRow[];

  if (existing[0]?.id) return existing[0].id;

  const created = await sql`
    INSERT INTO ingredients (name, category)
    VALUES (${name}, 'autre')
    RETURNING id
  ` as unknown as InsertIngredientRow[];

  return created[0].id;
}

export async function createRecipeFromReview(payload: RecipeReviewPayload): Promise<number> {
  const insertedRecipes = await sql`
    INSERT INTO recipes (
      name,
      cuisine_type,
      dish_type,
      servings,
      prep_time,
      cook_time,
      source_url,
      author,
      notes
    )
    VALUES (
      ${payload.name},
      ${payload.cuisineType},
      ${payload.dishType},
      ${payload.servings},
      ${payload.prepTime},
      ${payload.cookTime},
      ${payload.sourceUrl},
      ${payload.author},
      ${payload.notes}
    )
    RETURNING id
  ` as unknown as InsertRecipeRow[];

  const recipeId = insertedRecipes[0]?.id;

  if (!recipeId) {
    throw new Error('Impossible de creer la recette en base.');
  }

  for (const ingredient of payload.ingredients) {
    const ingredientId = await getOrCreateIngredientId(ingredient.text);

    await sql`
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
      VALUES (${recipeId}, ${ingredientId}, NULL, NULL)
    `;
  }

  for (const step of payload.steps) {
    await sql`
      INSERT INTO recipe_steps (recipe_id, step_number, instruction, source)
      VALUES (${recipeId}, ${step.step}, ${step.instruction}, 'original')
    `;
  }

  return recipeId;
}
