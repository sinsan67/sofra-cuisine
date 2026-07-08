type RecipeJsonLd = {
  '@type'?: string | string[];
  name?: string;
  description?: string;
  author?: { name?: string } | Array<{ name?: string }> | string;
  recipeYield?: string | string[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeIngredient?: string[];
  recipeInstructions?:
    | string
    | Array<string | { text?: string; name?: string; itemListElement?: Array<{ text?: string }> }>;
};

export type ImportedIngredient = {
  text: string;
};

export type ImportedStep = {
  step: number;
  instruction: string;
};

export type RecipeImportDraft = {
  sourceUrl: string;
  sourceDomain: string;
  name: string | null;
  author: string | null;
  notes: string | null;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  ingredients: ImportedIngredient[];
  steps: ImportedStep[];
  rawTitle: string | null;
  rawDescription: string | null;
  warnings: string[];
};

export type RecipeReviewPayload = {
  name: string;
  author: string | null;
  notes: string | null;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  sourceUrl: string | null;
  cuisineType: string | null;
  dishType: string | null;
  ingredients: ImportedIngredient[];
  steps: ImportedStep[];
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = stripTags(value).trim();
  return normalized || null;
}

function parseMetaContent(html: string, key: string, attr: 'name' | 'property'): string | null {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  );
  const contentFirst = html.match(pattern)?.[1];

  if (contentFirst) return normalizeText(contentFirst);

  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["'][^>]*>`,
    'i',
  );
  return normalizeText(html.match(reversePattern)?.[1] ?? null);
}

function parseTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return normalizeText(match?.[1] ?? null);
}

function extractJsonLdBlocks(html: string): unknown[] {
  const values: unknown[] = [];

  const matches = html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi);

  for (const match of matches) {
    const normalizedAttributes = decodeHtmlEntities(match[1] ?? '').toLowerCase();

    if (!normalizedAttributes.includes('type="application/ld+json"') &&
        !normalizedAttributes.includes("type='application/ld+json'")) {
      continue;
    }

    const raw = match[2]?.trim();

    if (!raw) continue;

    try {
      values.push(JSON.parse(raw));
    } catch {
      continue;
    }
  }

  return values;
}

function flattenJsonLdRecipeCandidates(value: unknown): RecipeJsonLd[] {
  if (!value || typeof value !== 'object') return [];

  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLdRecipeCandidates);
  }

  const record = value as Record<string, unknown>;

  if (record['@graph']) {
    return flattenJsonLdRecipeCandidates(record['@graph']);
  }

  const type = record['@type'];
  const types = Array.isArray(type) ? type : [type];

  if (types.some((entry) => entry === 'Recipe')) {
    return [record as RecipeJsonLd];
  }

  return [];
}

function parseDurationMinutes(value: string | null | undefined): number | null {
  if (!value) return null;

  const match = value.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?)$/i);
  if (!match) return null;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const total = hours * 60 + minutes;

  return total > 0 ? total : null;
}

function parseYieldToServings(value: string | string[] | null | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  const match = String(raw).match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;

  const servings = Number(match[1].replace(',', '.'));
  return Number.isFinite(servings) ? servings : null;
}

function normalizeInstructions(recipeInstructions: RecipeJsonLd['recipeInstructions']): ImportedStep[] {
  if (!recipeInstructions) return [];

  const flattened = Array.isArray(recipeInstructions) ? recipeInstructions : [recipeInstructions];
  const instructions = flattened.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (entry?.text) return [entry.text];
    if (Array.isArray(entry?.itemListElement)) {
      return entry.itemListElement.map((item) => item.text ?? '').filter(Boolean);
    }
    if (entry?.name) return [entry.name];
    return [];
  });

  return instructions
    .map((instruction) => normalizeText(instruction))
    .filter((instruction): instruction is string => Boolean(instruction))
    .map((instruction, index) => ({
      step: index + 1,
      instruction,
    }));
}

function normalizeIngredients(recipeIngredient: string[] | null | undefined): ImportedIngredient[] {
  if (!recipeIngredient) return [];

  return recipeIngredient
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item))
    .map((text) => ({ text }));
}

function getAuthorName(author: RecipeJsonLd['author']): string | null {
  if (!author) return null;
  if (typeof author === 'string') return normalizeText(author);
  if (Array.isArray(author)) return normalizeText(author[0]?.name ?? null);
  return normalizeText(author.name ?? null);
}

export async function buildRecipeImportDraftFromUrl(inputUrl: string): Promise<RecipeImportDraft> {
  const url = new URL(inputUrl);
  const response = await fetch(url, {
    headers: {
      'user-agent': 'SofraCuisineBot/0.1 (+https://sofra-cuisine.vercel.app)',
      accept: 'text/html,application/xhtml+xml',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`La page source a répondu avec ${response.status}.`);
  }

  const html = await response.text();
  const rawTitle =
    parseMetaContent(html, 'og:title', 'property') ??
    parseMetaContent(html, 'twitter:title', 'name') ??
    parseTitle(html);
  const rawDescription =
    parseMetaContent(html, 'description', 'name') ??
    parseMetaContent(html, 'og:description', 'property');

  const recipeCandidates = extractJsonLdBlocks(html).flatMap(flattenJsonLdRecipeCandidates);
  const recipe = recipeCandidates[0];

  const draft: RecipeImportDraft = {
    sourceUrl: response.url,
    sourceDomain: new URL(response.url).hostname.replace(/^www\./, ''),
    name: normalizeText(recipe?.name) ?? rawTitle,
    author: getAuthorName(recipe?.author),
    notes: normalizeText(recipe?.description) ?? rawDescription,
    servings: parseYieldToServings(recipe?.recipeYield),
    prepTime: parseDurationMinutes(recipe?.prepTime),
    cookTime: parseDurationMinutes(recipe?.cookTime),
    totalTime: parseDurationMinutes(recipe?.totalTime),
    ingredients: normalizeIngredients(recipe?.recipeIngredient),
    steps: normalizeInstructions(recipe?.recipeInstructions),
    rawTitle,
    rawDescription,
    warnings: [],
  };

  if (!recipe) {
    draft.warnings.push('Aucun bloc Recipe JSON-LD détecté. Le brouillon repose surtout sur les métadonnées de page.');
  }

  if (draft.ingredients.length === 0) {
    draft.warnings.push('Aucun ingrédient structuré détecté. Il faudra les ressaisir à la main.');
  }

  if (draft.steps.length === 0) {
    draft.warnings.push('Aucune étape structurée détectée. Il faudra les ressaisir à la main.');
  }

  if (!draft.name) {
    draft.warnings.push('Le nom de recette n’a pas pu être extrait automatiquement.');
  }

  return draft;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeOptionalInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const number = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0) return null;

  return Math.round(number);
}

export function buildRecipeReviewPayload(formData: FormData): RecipeReviewPayload {
  const ingredients = String(formData.get('ingredientsText') ?? '')
    .split('\n')
    .map((line) => normalizeOptionalText(line))
    .filter((line): line is string => Boolean(line))
    .map((text) => ({ text }));

  const steps = String(formData.get('stepsText') ?? '')
    .split('\n')
    .map((line) => normalizeOptionalText(line))
    .filter((line): line is string => Boolean(line))
    .map((instruction, index) => ({
      step: index + 1,
      instruction,
    }));

  return {
    name: normalizeOptionalText(String(formData.get('name') ?? '')) ?? 'Recette sans titre',
    author: normalizeOptionalText(String(formData.get('author') ?? '')),
    notes: normalizeOptionalText(String(formData.get('notes') ?? '')),
    servings: normalizeOptionalInteger(String(formData.get('servings') ?? '')),
    prepTime: normalizeOptionalInteger(String(formData.get('prepTime') ?? '')),
    cookTime: normalizeOptionalInteger(String(formData.get('cookTime') ?? '')),
    sourceUrl: normalizeOptionalText(String(formData.get('sourceUrl') ?? '')),
    cuisineType: normalizeOptionalText(String(formData.get('cuisineType') ?? '')),
    dishType: normalizeOptionalText(String(formData.get('dishType') ?? '')),
    ingredients,
    steps,
  };
}
