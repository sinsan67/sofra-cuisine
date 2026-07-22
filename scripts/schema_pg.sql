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
    created_at    TEXT DEFAULT CURRENT_DATE,
    original_locale TEXT DEFAULT 'fr'
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

CREATE TABLE IF NOT EXISTS recipe_translations (
    id         SERIAL PRIMARY KEY,
    recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    locale     TEXT NOT NULL,
    name       TEXT NOT NULL,
    notes      TEXT,
    UNIQUE (recipe_id, locale)
);

CREATE TABLE IF NOT EXISTS ingredient_translations (
    id             SERIAL PRIMARY KEY,
    ingredient_id  INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    locale         TEXT NOT NULL,
    name           TEXT NOT NULL,
    UNIQUE (ingredient_id, locale)
);

CREATE TABLE IF NOT EXISTS recipe_step_translations (
    id              SERIAL PRIMARY KEY,
    recipe_step_id  INTEGER NOT NULL REFERENCES recipe_steps(id) ON DELETE CASCADE,
    locale          TEXT NOT NULL,
    instruction     TEXT NOT NULL,
    UNIQUE (recipe_step_id, locale)
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
CREATE INDEX IF NOT EXISTS idx_recipe_translations_recipe_locale ON recipe_translations(recipe_id, locale);
CREATE INDEX IF NOT EXISTS idx_ingredient_translations_ingredient_locale ON ingredient_translations(ingredient_id, locale);
CREATE INDEX IF NOT EXISTS idx_recipe_step_translations_step_locale ON recipe_step_translations(recipe_step_id, locale);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe           ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_group_value      ON recipe_tags(tag_group, tag_value);

-- ─────────────────────────────────────────
-- S010 — Socle documentaire mutualise
-- ─────────────────────────────────────────
-- Ce bloc est additif : il prepare la migration progressive depuis `recipes`
-- vers un modele "source fidele -> structure recette -> publication par app".

CREATE TABLE IF NOT EXISTS document_sources (
    id                 SERIAL PRIMARY KEY,
    source_kind        TEXT NOT NULL CHECK (
        source_kind IN ('book', 'website', 'magazine', 'notebook', 'scan_batch', 'pdf', 'other')
    ),
    title              TEXT,
    subtitle           TEXT,
    author             TEXT,
    publisher          TEXT,
    publication_year   INTEGER,
    language_code      TEXT,
    isbn               TEXT,
    source_url         TEXT,
    source_file        TEXT,
    notes              TEXT,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_assets (
    id                 SERIAL PRIMARY KEY,
    source_id          INTEGER NOT NULL REFERENCES document_sources(id) ON DELETE CASCADE,
    asset_kind         TEXT NOT NULL CHECK (
        asset_kind IN ('photo', 'scan', 'pdf', 'image', 'web_capture', 'ocr_export', 'other')
    ),
    storage_path       TEXT,
    original_filename  TEXT,
    mime_type          TEXT,
    checksum           TEXT,
    page_count         INTEGER,
    width_px           INTEGER,
    height_px          INTEGER,
    captured_at        TIMESTAMPTZ,
    is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_pages (
    id                 SERIAL PRIMARY KEY,
    source_id          INTEGER NOT NULL REFERENCES document_sources(id) ON DELETE CASCADE,
    asset_id           INTEGER REFERENCES source_assets(id) ON DELETE SET NULL,
    page_number        INTEGER NOT NULL,
    page_label         TEXT,
    image_path         TEXT,
    ocr_text           TEXT,
    width_px           INTEGER,
    height_px          INTEGER,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, page_number)
);

CREATE TABLE IF NOT EXISTS source_page_blocks (
    id                 SERIAL PRIMARY KEY,
    page_id            INTEGER NOT NULL REFERENCES source_pages(id) ON DELETE CASCADE,
    block_order        INTEGER NOT NULL,
    block_kind         TEXT NOT NULL CHECK (
        block_kind IN ('title', 'subtitle', 'paragraph', 'ingredient', 'instruction', 'note', 'image', 'footer', 'other')
    ),
    raw_text           TEXT,
    bbox               JSONB,
    ocr_confidence     NUMERIC(5,4),
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (page_id, block_order)
);

CREATE TABLE IF NOT EXISTS recipe_documents (
    id                 SERIAL PRIMARY KEY,
    legacy_recipe_id   INTEGER UNIQUE REFERENCES recipes(id) ON DELETE SET NULL,
    source_id          INTEGER REFERENCES document_sources(id) ON DELETE SET NULL,
    document_kind      TEXT NOT NULL CHECK (
        document_kind IN ('recipe', 'preparation', 'article', 'note', 'menu', 'glossary', 'other')
    ),
    workflow_status    TEXT NOT NULL DEFAULT 'draft' CHECK (
        workflow_status IN ('draft', 'reviewed', 'published', 'archived')
    ),
    canonical_locale   TEXT NOT NULL DEFAULT 'fr',
    title              TEXT NOT NULL,
    subtitle           TEXT,
    summary            TEXT,
    intro              TEXT,
    notes              TEXT,
    author             TEXT,
    country_code       TEXT,
    rating             INTEGER CHECK (rating BETWEEN 1 AND 5),
    made_count         INTEGER NOT NULL DEFAULT 0,
    last_made          DATE,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_document_translations (
    id                 SERIAL PRIMARY KEY,
    document_id        INTEGER NOT NULL REFERENCES recipe_documents(id) ON DELETE CASCADE,
    locale             TEXT NOT NULL,
    title              TEXT NOT NULL,
    subtitle           TEXT,
    summary            TEXT,
    intro              TEXT,
    notes              TEXT,
    UNIQUE (document_id, locale)
);

CREATE TABLE IF NOT EXISTS document_blocks (
    id                 SERIAL PRIMARY KEY,
    document_id        INTEGER NOT NULL REFERENCES recipe_documents(id) ON DELETE CASCADE,
    locale             TEXT NOT NULL DEFAULT 'fr',
    block_order        INTEGER NOT NULL,
    block_type         TEXT NOT NULL CHECK (
        block_type IN (
            'heading', 'subheading', 'intro', 'paragraph', 'ingredient_group',
            'ingredient_item', 'instruction', 'tip', 'anecdote', 'variation',
            'equipment', 'note', 'quote', 'other'
        )
    ),
    source_mode        TEXT NOT NULL DEFAULT 'normalized' CHECK (
        source_mode IN ('raw', 'normalized', 'published')
    ),
    body_text          TEXT,
    data_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, locale, block_order)
);

CREATE TABLE IF NOT EXISTS document_provenance (
    id                 SERIAL PRIMARY KEY,
    document_id        INTEGER NOT NULL REFERENCES recipe_documents(id) ON DELETE CASCADE,
    target_kind        TEXT NOT NULL CHECK (
        target_kind IN (
            'document', 'block', 'recipe_structure', 'ingredient_group',
            'ingredient_item', 'instruction', 'publication'
        )
    ),
    target_id          INTEGER NOT NULL,
    page_id            INTEGER REFERENCES source_pages(id) ON DELETE SET NULL,
    source_block_id    INTEGER REFERENCES source_page_blocks(id) ON DELETE SET NULL,
    quote_text         TEXT,
    bbox               JSONB,
    confidence_score   NUMERIC(5,4),
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_relationships (
    id                 SERIAL PRIMARY KEY,
    from_document_id   INTEGER NOT NULL REFERENCES recipe_documents(id) ON DELETE CASCADE,
    to_document_id     INTEGER NOT NULL REFERENCES recipe_documents(id) ON DELETE CASCADE,
    relation_type      TEXT NOT NULL CHECK (
        relation_type IN (
            'variant_of', 'derived_from', 'pair_with', 'side_for',
            'references', 'same_source_as', 'translation_of', 'about'
        )
    ),
    position           INTEGER,
    notes              TEXT,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (from_document_id, to_document_id, relation_type)
);

CREATE TABLE IF NOT EXISTS recipe_structures (
    id                 SERIAL PRIMARY KEY,
    document_id        INTEGER NOT NULL UNIQUE REFERENCES recipe_documents(id) ON DELETE CASCADE,
    cuisine_type       TEXT,
    dish_type          TEXT,
    servings_value     NUMERIC(8,2),
    servings_text      TEXT,
    prep_time_minutes  INTEGER,
    cook_time_minutes  INTEGER,
    total_time_minutes INTEGER,
    difficulty         TEXT,
    yield_text         TEXT,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredient_groups_v1 (
    id                  SERIAL PRIMARY KEY,
    recipe_structure_id INTEGER NOT NULL REFERENCES recipe_structures(id) ON DELETE CASCADE,
    group_order         INTEGER NOT NULL,
    title               TEXT,
    raw_title           TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (recipe_structure_id, group_order)
);

CREATE TABLE IF NOT EXISTS recipe_ingredient_items_v1 (
    id                  SERIAL PRIMARY KEY,
    ingredient_group_id INTEGER NOT NULL REFERENCES recipe_ingredient_groups_v1(id) ON DELETE CASCADE,
    ingredient_order    INTEGER NOT NULL,
    ingredient_id       INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
    raw_text            TEXT NOT NULL,
    ingredient_text     TEXT,
    quantity_value      NUMERIC(10,3),
    quantity_text       TEXT,
    unit_text           TEXT,
    preparation_text    TEXT,
    note_text           TEXT,
    is_optional         BOOLEAN NOT NULL DEFAULT FALSE,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ingredient_group_id, ingredient_order)
);

CREATE TABLE IF NOT EXISTS recipe_instructions_v1 (
    id                  SERIAL PRIMARY KEY,
    recipe_structure_id INTEGER NOT NULL REFERENCES recipe_structures(id) ON DELETE CASCADE,
    step_number         INTEGER NOT NULL,
    title               TEXT,
    raw_text            TEXT NOT NULL,
    instruction_text    TEXT,
    source_kind         TEXT NOT NULL DEFAULT 'original' CHECK (
        source_kind IN ('original', 'normalized', 'suggested')
    ),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (recipe_structure_id, step_number, source_kind)
);

CREATE TABLE IF NOT EXISTS document_publications (
    id                 SERIAL PRIMARY KEY,
    document_id        INTEGER NOT NULL REFERENCES recipe_documents(id) ON DELETE CASCADE,
    app_key            TEXT NOT NULL,
    publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (
        publication_status IN ('draft', 'staged', 'published', 'archived')
    ),
    locale             TEXT NOT NULL DEFAULT 'fr',
    slug               TEXT,
    title_override     TEXT,
    summary_override   TEXT,
    is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
    published_at       TIMESTAMPTZ,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, app_key, locale)
);

CREATE INDEX IF NOT EXISTS idx_document_sources_kind ON document_sources(source_kind);
CREATE INDEX IF NOT EXISTS idx_source_assets_source ON source_assets(source_id);
CREATE INDEX IF NOT EXISTS idx_source_assets_primary ON source_assets(source_id, is_primary DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_source_pages_source ON source_pages(source_id, page_number);
CREATE INDEX IF NOT EXISTS idx_source_page_blocks_page ON source_page_blocks(page_id, block_order);
CREATE INDEX IF NOT EXISTS idx_recipe_documents_kind ON recipe_documents(document_kind, workflow_status);
CREATE INDEX IF NOT EXISTS idx_recipe_documents_source ON recipe_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_recipe_document_translations_doc ON recipe_document_translations(document_id, locale);
CREATE INDEX IF NOT EXISTS idx_document_blocks_doc ON document_blocks(document_id, locale, block_order);
CREATE INDEX IF NOT EXISTS idx_document_provenance_target ON document_provenance(target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_document_relationships_from ON document_relationships(from_document_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_document_relationships_to ON document_relationships(to_document_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_recipe_structures_document ON recipe_structures(document_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_groups_structure ON recipe_ingredient_groups_v1(recipe_structure_id, group_order);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_items_group ON recipe_ingredient_items_v1(ingredient_group_id, ingredient_order);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_items_ingredient ON recipe_ingredient_items_v1(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_instructions_structure ON recipe_instructions_v1(recipe_structure_id, step_number);
CREATE INDEX IF NOT EXISTS idx_document_publications_app ON document_publications(app_key, publication_status, locale);

DROP VIEW IF EXISTS recipe_document_recipe_compat_v1;
CREATE VIEW recipe_document_recipe_compat_v1 AS
SELECT
    d.id,
    d.legacy_recipe_id,
    COALESCE(dt.title, d.title) AS name,
    COALESCE(dt.notes, d.notes) AS notes,
    rs.cuisine_type,
    rs.dish_type,
    rs.servings_value AS servings,
    rs.prep_time_minutes AS prep_time,
    rs.cook_time_minutes AS cook_time,
    ds.source_url,
    COALESCE(sa.storage_path, ds.source_file) AS source_file,
    d.country_code,
    d.rating,
    d.made_count,
    d.last_made,
    d.author,
    d.created_at::date AS created_at
FROM recipe_documents d
LEFT JOIN recipe_document_translations dt
    ON dt.document_id = d.id
   AND dt.locale = d.canonical_locale
LEFT JOIN recipe_structures rs
    ON rs.document_id = d.id
LEFT JOIN document_sources ds
    ON ds.id = d.source_id
LEFT JOIN LATERAL (
    SELECT storage_path
    FROM source_assets
    WHERE source_id = ds.id
    ORDER BY is_primary DESC, id DESC
    LIMIT 1
) sa ON TRUE
WHERE d.document_kind IN ('recipe', 'preparation');

DROP VIEW IF EXISTS recipe_document_ingredient_compat_v1;
CREATE VIEW recipe_document_ingredient_compat_v1 AS
SELECT
    rs.document_id AS recipe_id,
    rii.id,
    COALESCE(i.name, rii.ingredient_text, rii.raw_text) AS name,
    i.category,
    rii.quantity_value::DOUBLE PRECISION AS quantity,
    rii.unit_text AS unit,
    rii.is_optional AS optional,
    COALESCE(rii.note_text, rii.preparation_text) AS note,
    rii.raw_text
FROM recipe_ingredient_items_v1 rii
JOIN recipe_ingredient_groups_v1 rig
    ON rig.id = rii.ingredient_group_id
JOIN recipe_structures rs
    ON rs.id = rig.recipe_structure_id
LEFT JOIN ingredients i
    ON i.id = rii.ingredient_id;

DROP VIEW IF EXISTS recipe_document_step_compat_v1;
CREATE VIEW recipe_document_step_compat_v1 AS
SELECT
    rs.document_id AS recipe_id,
    ri.id,
    ri.step_number,
    COALESCE(ri.instruction_text, ri.raw_text) AS instruction,
    CASE
        WHEN ri.source_kind = 'suggested' THEN 'suggested'
        ELSE 'original'
    END AS source,
    ri.raw_text
FROM recipe_instructions_v1 ri
JOIN recipe_structures rs
    ON rs.id = ri.recipe_structure_id;
