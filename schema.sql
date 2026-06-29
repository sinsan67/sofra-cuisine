-- Base de données recettes personnelles
-- SQLite 3

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────
-- Ingrédients (référentiel)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL UNIQUE,          -- ex. "farine", "oeuf", "tomate cerise"
    category      TEXT NOT NULL DEFAULT 'autre', -- epicerie | frais | viande | poisson | legumes | fruits | surgele | autre
    default_unit  TEXT                           -- ex. "g", "ml", "pièce", "c. à soupe"
);

-- ─────────────────────────────────────────
-- Recettes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    cuisine_type  TEXT,                          -- ex. "italienne", "française", "asiatique"
    dish_type     TEXT,                          -- ex. "plat", "entrée", "dessert", "sauce"
    servings      INTEGER DEFAULT 4,
    prep_time     INTEGER,                       -- minutes
    cook_time     INTEGER,                       -- minutes
    source_url    TEXT,
    source_file   TEXT,                          -- chemin relatif vers photo/PDF dans sources/
    author        TEXT,                          -- ex. "maman", "slr", "Jamie Oliver"
    notes         TEXT,
    rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
    made_count    INTEGER DEFAULT 0,             -- nb de fois réalisée
    last_made     TEXT,                          -- date ISO : "2026-06-17"
    tags          TEXT,                          -- liste séparée par virgules : "rapide,végétarien"
    country_code  TEXT,                          -- code ISO 3166-1 alpha-2 : "FR", "TR", "IT"...
    created_at    TEXT DEFAULT (date('now'))
);

-- ─────────────────────────────────────────
-- Quantités d'ingrédients par recette (table pivot)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    quantity      REAL,                          -- null si "au goût"
    unit          TEXT,                          -- peut différer de default_unit
    optional      INTEGER DEFAULT 0,            -- 0 = obligatoire, 1 = facultatif
    note          TEXT                           -- ex. "émincé finement", "à température ambiante"
);

-- ─────────────────────────────────────────
-- Plan de repas (semaine en cours)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plan (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    planned_date  TEXT NOT NULL,                 -- date ISO : "2026-06-18"
    servings      INTEGER DEFAULT 4              -- peut différer des portions de la recette
);

-- ─────────────────────────────────────────
-- Garde-manger (ce que j'ai déjà)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pantry (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) UNIQUE,
    quantity      REAL,
    unit          TEXT,
    updated_at    TEXT DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- Étapes de préparation
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_steps (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number   INTEGER NOT NULL,               -- 1, 2, 3...
    instruction   TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'original' -- 'original' | 'suggested'
);

-- ─────────────────────────────────────────
-- Traductions des recettes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_translations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    locale     TEXT NOT NULL,                     -- ex. "fr", "en", "tr"
    name       TEXT NOT NULL,
    notes      TEXT,
    UNIQUE (recipe_id, locale)
);

CREATE TABLE IF NOT EXISTS ingredient_translations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id  INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    locale         TEXT NOT NULL,                -- ex. "fr", "en", "tr"
    name           TEXT NOT NULL,
    UNIQUE (ingredient_id, locale)
);

CREATE TABLE IF NOT EXISTS recipe_step_translations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_step_id  INTEGER NOT NULL REFERENCES recipe_steps(id) ON DELETE CASCADE,
    locale          TEXT NOT NULL,               -- ex. "fr", "en", "tr"
    instruction     TEXT NOT NULL,
    UNIQUE (recipe_step_id, locale)
);

-- ─────────────────────────────────────────
-- Tags à facettes
-- ─────────────────────────────────────────
-- Remplace la colonne `tags` (texte libre) de recipes.
-- Groupes définis : origine | collection | saison | caractere | regime
--                   occasion | evenement | ingredient-cle | style
CREATE TABLE IF NOT EXISTS recipe_tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_group  TEXT NOT NULL,  -- ex. "origine", "collection", "saison"
    tag_value  TEXT NOT NULL,  -- ex. "turque", "kiyma", "été"
    UNIQUE (recipe_id, tag_group, tag_value)
);

-- ─────────────────────────────────────────
-- Index utiles
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_date ON meal_plan(planned_date);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_translations_recipe_locale ON recipe_translations(recipe_id, locale);
CREATE INDEX IF NOT EXISTS idx_ingredient_translations_ingredient_locale ON ingredient_translations(ingredient_id, locale);
CREATE INDEX IF NOT EXISTS idx_recipe_step_translations_step_locale ON recipe_step_translations(recipe_step_id, locale);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_group_value ON recipe_tags(tag_group, tag_value);
