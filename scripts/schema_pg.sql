-- Sofra Cuisine — schéma PostgreSQL
-- Adapté depuis schema.sql (SQLite) pour Neon

CREATE TABLE IF NOT EXISTS ingredients (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    category      TEXT NOT NULL DEFAULT 'autre',
    default_unit  TEXT
);

CREATE TABLE IF NOT EXISTS recipes (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    cuisine_type  TEXT,
    dish_type     TEXT,
    servings      INTEGER DEFAULT 4,
    prep_time     INTEGER,
    cook_time     INTEGER,
    source_url    TEXT,
    source_file   TEXT,
    author        TEXT,
    notes         TEXT,
    rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
    made_count    INTEGER DEFAULT 0,
    last_made     TEXT,
    tags          TEXT,
    country_code  TEXT,
    created_at    TEXT DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id            SERIAL PRIMARY KEY,
    recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    quantity      REAL,
    unit          TEXT,
    optional      INTEGER DEFAULT 0,
    note          TEXT
);

CREATE TABLE IF NOT EXISTS meal_plan (
    id            SERIAL PRIMARY KEY,
    recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    planned_date  TEXT NOT NULL,
    servings      INTEGER DEFAULT 4
);

CREATE TABLE IF NOT EXISTS pantry (
    id            SERIAL PRIMARY KEY,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) UNIQUE,
    quantity      REAL,
    unit          TEXT,
    updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipe_steps (
    id            SERIAL PRIMARY KEY,
    recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number   INTEGER NOT NULL,
    instruction   TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'original'
);

CREATE TABLE IF NOT EXISTS recipe_tags (
    id         SERIAL PRIMARY KEY,
    recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_group  TEXT NOT NULL,
    tag_value  TEXT NOT NULL,
    UNIQUE (recipe_id, tag_group, tag_value)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe    ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_date               ON meal_plan(planned_date);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe          ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe           ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_group_value      ON recipe_tags(tag_group, tag_value);
