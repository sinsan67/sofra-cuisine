import { sql } from './db';
import type { Recipe } from './recipes';

type RawRecipe = Omit<Recipe, 'ingredients' | 'steps' | 'tags'>;
type RawIngredient = { recipe_id: number; name: string; category: string | null; quantity: number | null; unit: string | null };
type RawStep = { recipe_id: number; step_number: number; instruction: string; source: 'original' | 'suggested' };
type RawTag = { recipe_id: number; tag_group: string; tag_value: string };

let documentCompatReadyPromise: Promise<boolean> | null = null;

async function isDocumentCompatReady(): Promise<boolean> {
  if (!documentCompatReadyPromise) {
    documentCompatReadyPromise = (async () => {
      const result = await sql`
        SELECT COUNT(*)::int AS count
             , CASE
                 WHEN to_regclass('public.recipe_documents') IS NULL THEN 0
                 ELSE (SELECT COUNT(*)::int FROM recipe_documents)
               END AS document_count
             , CASE
                 WHEN to_regclass('public.recipes') IS NULL THEN 0
                 ELSE (SELECT COUNT(*)::int FROM recipes)
               END AS legacy_count
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name IN (
            'recipe_document_recipe_compat_v1',
            'recipe_document_ingredient_compat_v1',
            'recipe_document_step_compat_v1'
          )
      `;

      const row = result[0];

      return (
        Number(row?.count ?? 0) === 3 &&
        Number(row?.legacy_count ?? 0) > 0 &&
        Number(row?.document_count ?? 0) >= Number(row?.legacy_count ?? 0)
      );
    })().catch(() => false);
  }

  return documentCompatReadyPromise;
}

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
  const useDocumentCompat = await isDocumentCompatReady();
  const [raws, ings, steps, tags] = await (useDocumentCompat
    ? Promise.all([
        sql`
          SELECT
            r.id,
            COALESCE(rt.title, r.name) AS name,
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
          FROM recipe_document_recipe_compat_v1 r
          LEFT JOIN recipe_document_translations rt
            ON rt.document_id = r.id AND rt.locale = ${locale}
          ORDER BY name
        `,
        sql`
          SELECT
            ri.recipe_id,
            ri.name,
            ri.category,
            ri.quantity,
            ri.unit
          FROM recipe_document_ingredient_compat_v1 ri
        `,
        sql`
          SELECT
            rs.recipe_id,
            rs.step_number,
            COALESCE(rst.instruction, rs.instruction) AS instruction,
            rs.source
          FROM recipe_document_step_compat_v1 rs
          LEFT JOIN recipe_instructions_v1 ri
            ON ri.id = rs.id
          LEFT JOIN recipe_step_translations rst
            ON rst.recipe_step_id = (ri.metadata ->> 'legacy_recipe_step_id')::int
           AND rst.locale = ${locale}
          ORDER BY recipe_id, step_number
        `,
        sql`
          SELECT
            d.id AS recipe_id,
            tag_group,
            tag_value
          FROM recipe_tags
          JOIN recipe_documents d
            ON d.legacy_recipe_id = recipe_tags.recipe_id
        `,
      ])
    : Promise.all([
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
      ]));

  return assemble(
    raws as unknown as RawRecipe[],
    ings as unknown as RawIngredient[],
    steps as unknown as RawStep[],
    tags as unknown as RawTag[],
  );
}

export async function getRecipeById(id: number, locale = 'fr'): Promise<Recipe | undefined> {
  const useDocumentCompat = await isDocumentCompatReady();
  const [raws, ings, steps, tags] = await (useDocumentCompat
    ? Promise.all([
        sql`
          SELECT
            r.id,
            COALESCE(rt.title, r.name) AS name,
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
          FROM recipe_document_recipe_compat_v1 r
          LEFT JOIN recipe_document_translations rt
            ON rt.document_id = r.id AND rt.locale = ${locale}
          WHERE r.id = ${id}
        `,
        sql`
          SELECT
            ri.recipe_id,
            ri.name,
            ri.category,
            ri.quantity,
            ri.unit
          FROM recipe_document_ingredient_compat_v1 ri
          WHERE ri.recipe_id = ${id}
        `,
        sql`
          SELECT
            rs.recipe_id,
            rs.step_number,
            COALESCE(rst.instruction, rs.instruction) AS instruction,
            rs.source
          FROM recipe_document_step_compat_v1 rs
          LEFT JOIN recipe_instructions_v1 ri
            ON ri.id = rs.id
          LEFT JOIN recipe_step_translations rst
            ON rst.recipe_step_id = (ri.metadata ->> 'legacy_recipe_step_id')::int
           AND rst.locale = ${locale}
          WHERE rs.recipe_id = ${id}
          ORDER BY step_number
        `,
        sql`
          SELECT
            d.id AS recipe_id,
            rt.tag_group,
            rt.tag_value
          FROM recipe_tags rt
          JOIN recipe_documents d
            ON d.legacy_recipe_id = rt.recipe_id
          WHERE d.id = ${id}
        `,
      ])
    : Promise.all([
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
      ]));

  if (raws.length === 0) return undefined;

  return assemble(
    raws as unknown as RawRecipe[],
    ings as unknown as RawIngredient[],
    steps as unknown as RawStep[],
    tags as unknown as RawTag[],
  )[0];
}
