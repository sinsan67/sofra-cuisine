#!/usr/bin/env python3
"""
Backfill du modele documentaire V1 depuis le schema historique `recipes*`.

Pourquoi ce script :
- peupler `recipe_documents` et les tables associees sans casser l'existant ;
- conserver les IDs historiques pour que les routes du front restent stables ;
- permettre des reruns sans dupliquer les donnees.

Usage :
    python3 scripts/backfill_recipe_documents_v1.py --dry-run
    python3 scripts/backfill_recipe_documents_v1.py
    python3 scripts/backfill_recipe_documents_v1.py --recipe-id 12
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import Json, RealDictCursor

from scripts.add_recipe_neon import load_database_url

ROOT = Path(__file__).parent.parent
APP_KEY = "sofra-cuisine"
BACKFILL_MARKER = "legacy_recipe_backfill_v1"


@dataclass
class BackfillSummary:
    recipes_seen: int = 0
    documents_upserted: int = 0
    translations_upserted: int = 0
    groups_upserted: int = 0
    ingredient_items_upserted: int = 0
    instructions_upserted: int = 0
    document_blocks_rebuilt: int = 0
    publications_upserted: int = 0
    sources_upserted: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill le modele documentaire V1 dans Neon.")
    parser.add_argument("--dry-run", action="store_true", help="Prepare tout puis annule la transaction.")
    parser.add_argument("--recipe-id", type=int, help="Limiter le backfill a une recette historique.")
    return parser.parse_args()


def get_connection():
    return psycopg2.connect(load_database_url())


def ensure_document_model_exists(cur) -> None:
    cur.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'document_sources',
            'recipe_documents',
            'recipe_structures',
            'recipe_ingredient_groups_v1',
            'recipe_ingredient_items_v1',
            'recipe_instructions_v1',
            'document_publications'
          )
        """
    )
    present = {row["table_name"] for row in cur.fetchall()}
    required = {
        "document_sources",
        "recipe_documents",
        "recipe_structures",
        "recipe_ingredient_groups_v1",
        "recipe_ingredient_items_v1",
        "recipe_instructions_v1",
        "document_publications",
    }
    missing = sorted(required - present)
    if missing:
        missing_list = ", ".join(missing)
        raise RuntimeError(
            "Le schema documentaire V1 n'est pas disponible sur cette base. "
            f"Tables manquantes : {missing_list}"
        )


def has_recipe_column(cur, column_name: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'recipes'
          AND column_name = %s
        """,
        (column_name,),
    )
    return cur.fetchone() is not None


def parse_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_created_at(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def infer_source_kind(recipe: dict[str, Any]) -> str:
    source_file = (recipe.get("source_file") or "").lower()
    source_url = (recipe.get("source_url") or "").lower()
    if source_file.endswith(".pdf"):
        return "pdf"
    if source_url.startswith("http://") or source_url.startswith("https://"):
        return "website"
    if source_file:
        return "scan_batch"
    return "other"


def infer_asset_kind(recipe: dict[str, Any]) -> str:
    source_file = (recipe.get("source_file") or "").lower()
    if source_file.endswith(".pdf"):
        return "pdf"
    if source_file.endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")):
        return "photo"
    if recipe.get("source_url"):
        return "web_capture"
    return "other"


def decimal_to_string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        normalized = value.normalize()
        return format(normalized, "f").rstrip("0").rstrip(".") or "0"
    if isinstance(value, float):
        text = f"{value:.3f}".rstrip("0").rstrip(".")
        return text or "0"
    return str(value)


def build_ingredient_raw_text(row: dict[str, Any]) -> str:
    parts = [
        decimal_to_string(row.get("quantity")),
        row.get("unit"),
        row.get("ingredient_name"),
    ]
    base = " ".join(part for part in parts if part)
    if row.get("note"):
        return f"{base} ({row['note']})"
    return base


def fetch_recipes(cur, recipe_id: int | None, include_original_locale: bool) -> list[dict[str, Any]]:
    original_locale_sql = "r.original_locale," if include_original_locale else "'fr' AS original_locale,"
    recipe_filter_sql = "WHERE r.id = %s" if recipe_id is not None else ""
    params: tuple[Any, ...] = (recipe_id,) if recipe_id is not None else ()
    cur.execute(
        f"""
        SELECT
            r.id,
            r.name,
            r.cuisine_type,
            r.dish_type,
            r.servings,
            r.prep_time,
            r.cook_time,
            r.source_url,
            r.source_file,
            r.author,
            r.notes,
            r.rating,
            r.made_count,
            r.last_made,
            r.tags,
            r.country_code,
            r.created_at,
            {original_locale_sql}
            COALESCE(
                jsonb_object_agg(rt.locale, jsonb_build_object('name', rt.name, 'notes', rt.notes))
                    FILTER (WHERE rt.locale IS NOT NULL),
                '{{}}'::jsonb
            ) AS translations,
            COALESCE(
                jsonb_object_agg(rt2.tag_group, rt2.values_json)
                    FILTER (WHERE rt2.tag_group IS NOT NULL),
                '{{}}'::jsonb
            ) AS facets
        FROM recipes r
        LEFT JOIN recipe_translations rt
            ON rt.recipe_id = r.id
        LEFT JOIN (
            SELECT recipe_id, tag_group, jsonb_agg(tag_value ORDER BY tag_value) AS values_json
            FROM recipe_tags
            GROUP BY recipe_id, tag_group
        ) rt2
            ON rt2.recipe_id = r.id
        {recipe_filter_sql}
        GROUP BY r.id
        ORDER BY r.id
        """,
        params,
    )
    return list(cur.fetchall())


def fetch_ingredients(cur, recipe_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not recipe_ids:
        return {}
    cur.execute(
        """
        SELECT
            ri.id,
            ri.recipe_id,
            ri.ingredient_id,
            i.name AS ingredient_name,
            i.category,
            ri.quantity,
            ri.unit,
            ri.optional,
            ri.note
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ANY(%s)
        ORDER BY ri.recipe_id, ri.id
        """,
        (recipe_ids,),
    )
    by_recipe: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in cur.fetchall():
        row["raw_text"] = build_ingredient_raw_text(row)
        by_recipe[row["recipe_id"]].append(row)
    return by_recipe


def fetch_steps(cur, recipe_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not recipe_ids:
        return {}
    cur.execute(
        """
        SELECT id, recipe_id, step_number, instruction, source
        FROM recipe_steps
        WHERE recipe_id = ANY(%s)
        ORDER BY recipe_id, step_number, id
        """,
        (recipe_ids,),
    )
    by_recipe: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in cur.fetchall():
        by_recipe[row["recipe_id"]].append(row)
    return by_recipe


def upsert_document_source(cur, recipe: dict[str, Any], summary: BackfillSummary) -> int | None:
    if not recipe.get("source_url") and not recipe.get("source_file"):
        return None

    cur.execute(
        """
        SELECT source_id
        FROM recipe_documents
        WHERE legacy_recipe_id = %s
        """,
        (recipe["id"],),
    )
    existing = cur.fetchone()
    source_id = existing["source_id"] if existing and existing["source_id"] else None

    source_metadata = {
        "generated_by": BACKFILL_MARKER,
        "legacy_recipe_id": recipe["id"],
    }

    if source_id is None:
        cur.execute(
            """
            INSERT INTO document_sources (
                source_kind,
                title,
                author,
                language_code,
                source_url,
                source_file,
                notes,
                metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                infer_source_kind(recipe),
                recipe["name"],
                recipe.get("author"),
                recipe.get("original_locale") or "fr",
                recipe.get("source_url"),
                recipe.get("source_file"),
                recipe.get("notes"),
                Json(source_metadata),
            ),
        )
        source_id = cur.fetchone()["id"]
        summary.sources_upserted += 1
    else:
        cur.execute(
            """
            UPDATE document_sources
            SET
                source_kind = %s,
                title = %s,
                author = %s,
                language_code = %s,
                source_url = %s,
                source_file = %s,
                notes = %s,
                metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                infer_source_kind(recipe),
                recipe["name"],
                recipe.get("author"),
                recipe.get("original_locale") or "fr",
                recipe.get("source_url"),
                recipe.get("source_file"),
                recipe.get("notes"),
                json.dumps(source_metadata),
                source_id,
            ),
        )

    cur.execute(
        """
        SELECT id
        FROM source_assets
        WHERE source_id = %s
          AND COALESCE(storage_path, '') = COALESCE(%s, '')
        LIMIT 1
        """,
        (source_id, recipe.get("source_file") or recipe.get("source_url")),
    )
    if cur.fetchone() is None:
        cur.execute(
            """
            INSERT INTO source_assets (
                source_id,
                asset_kind,
                storage_path,
                original_filename,
                is_primary,
                metadata
            )
            VALUES (%s, %s, %s, %s, TRUE, %s)
            """,
            (
                source_id,
                infer_asset_kind(recipe),
                recipe.get("source_file") or recipe.get("source_url"),
                Path(recipe["source_file"]).name if recipe.get("source_file") else None,
                Json(
                    {
                        "generated_by": BACKFILL_MARKER,
                        "legacy_recipe_id": recipe["id"],
                    }
                ),
            ),
        )
    return source_id


def upsert_recipe_document(
    cur,
    recipe: dict[str, Any],
    source_id: int | None,
    summary: BackfillSummary,
) -> int:
    metadata = {
        "generated_by": BACKFILL_MARKER,
        "legacy_recipe_id": recipe["id"],
        "legacy_tags_text": recipe.get("tags"),
        "legacy_facets": recipe.get("facets") or {},
        "original_locale": recipe.get("original_locale") or "fr",
    }
    created_at = parse_created_at(recipe.get("created_at"))
    cur.execute(
        """
        INSERT INTO recipe_documents (
            id,
            legacy_recipe_id,
            source_id,
            document_kind,
            workflow_status,
            canonical_locale,
            title,
            notes,
            author,
            country_code,
            rating,
            made_count,
            last_made,
            metadata,
            created_at,
            updated_at
        )
        VALUES (
            %s, %s, %s, 'recipe', 'draft', %s, %s, %s, %s, %s, %s, %s, %s, %s,
            COALESCE(%s, NOW()), NOW()
        )
        ON CONFLICT (legacy_recipe_id)
        DO UPDATE SET
            source_id = EXCLUDED.source_id,
            canonical_locale = EXCLUDED.canonical_locale,
            title = EXCLUDED.title,
            notes = EXCLUDED.notes,
            author = EXCLUDED.author,
            country_code = EXCLUDED.country_code,
            rating = EXCLUDED.rating,
            made_count = EXCLUDED.made_count,
            last_made = EXCLUDED.last_made,
            metadata = COALESCE(recipe_documents.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            updated_at = NOW()
        RETURNING id
        """,
        (
            recipe["id"],
            recipe["id"],
            source_id,
            recipe.get("original_locale") or "fr",
            recipe["name"],
            recipe.get("notes"),
            recipe.get("author"),
            recipe.get("country_code"),
            recipe.get("rating"),
            recipe.get("made_count") or 0,
            parse_date(recipe.get("last_made")),
            Json(metadata),
            created_at,
        ),
    )
    summary.documents_upserted += 1
    return cur.fetchone()["id"]


def upsert_document_translations(cur, document_id: int, recipe: dict[str, Any], summary: BackfillSummary) -> None:
    translations = recipe.get("translations") or {}
    for locale, payload in translations.items():
        cur.execute(
            """
            INSERT INTO recipe_document_translations (document_id, locale, title, notes)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (document_id, locale)
            DO UPDATE SET
                title = EXCLUDED.title,
                notes = EXCLUDED.notes
            """,
            (
                document_id,
                locale,
                payload.get("name") or recipe["name"],
                payload.get("notes"),
            ),
        )
        summary.translations_upserted += 1


def upsert_recipe_structure(cur, document_id: int, recipe: dict[str, Any]) -> int:
    facets = recipe.get("facets") or {}
    metadata = {
        "generated_by": BACKFILL_MARKER,
        "legacy_recipe_id": recipe["id"],
        "facets": facets,
    }
    cur.execute(
        """
        INSERT INTO recipe_structures (
            document_id,
            cuisine_type,
            dish_type,
            servings_value,
            servings_text,
            prep_time_minutes,
            cook_time_minutes,
            total_time_minutes,
            metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (document_id)
        DO UPDATE SET
            cuisine_type = EXCLUDED.cuisine_type,
            dish_type = EXCLUDED.dish_type,
            servings_value = EXCLUDED.servings_value,
            servings_text = EXCLUDED.servings_text,
            prep_time_minutes = EXCLUDED.prep_time_minutes,
            cook_time_minutes = EXCLUDED.cook_time_minutes,
            total_time_minutes = EXCLUDED.total_time_minutes,
            metadata = COALESCE(recipe_structures.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            updated_at = NOW()
        RETURNING id
        """,
        (
            document_id,
            recipe.get("cuisine_type"),
            recipe.get("dish_type"),
            recipe.get("servings"),
            str(recipe["servings"]) if recipe.get("servings") is not None else None,
            recipe.get("prep_time"),
            recipe.get("cook_time"),
            (recipe.get("prep_time") or 0) + (recipe.get("cook_time") or 0) or None,
            Json(metadata),
        ),
    )
    return cur.fetchone()["id"]


def upsert_default_ingredient_group(cur, recipe_structure_id: int, summary: BackfillSummary) -> int:
    cur.execute(
        """
        INSERT INTO recipe_ingredient_groups_v1 (
            recipe_structure_id,
            group_order,
            title,
            raw_title,
            metadata
        )
        VALUES (%s, 1, NULL, 'ingredients', %s)
        ON CONFLICT (recipe_structure_id, group_order)
        DO UPDATE SET
            raw_title = EXCLUDED.raw_title,
            metadata = COALESCE(recipe_ingredient_groups_v1.metadata, '{}'::jsonb) || EXCLUDED.metadata
        RETURNING id
        """,
        (
            recipe_structure_id,
            Json({"generated_by": BACKFILL_MARKER}),
        ),
    )
    summary.groups_upserted += 1
    return cur.fetchone()["id"]


def upsert_ingredient_items(
    cur,
    ingredient_group_id: int,
    ingredients: list[dict[str, Any]],
    summary: BackfillSummary,
) -> None:
    for index, ingredient in enumerate(ingredients, start=1):
        quantity_text = decimal_to_string(ingredient.get("quantity"))
        metadata = {
            "generated_by": BACKFILL_MARKER,
            "legacy_recipe_ingredient_id": ingredient["id"],
            "legacy_category": ingredient.get("category"),
        }
        cur.execute(
            """
            INSERT INTO recipe_ingredient_items_v1 (
                ingredient_group_id,
                ingredient_order,
                ingredient_id,
                raw_text,
                ingredient_text,
                quantity_value,
                quantity_text,
                unit_text,
                note_text,
                is_optional,
                metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (ingredient_group_id, ingredient_order)
            DO UPDATE SET
                ingredient_id = EXCLUDED.ingredient_id,
                raw_text = EXCLUDED.raw_text,
                ingredient_text = EXCLUDED.ingredient_text,
                quantity_value = EXCLUDED.quantity_value,
                quantity_text = EXCLUDED.quantity_text,
                unit_text = EXCLUDED.unit_text,
                note_text = EXCLUDED.note_text,
                is_optional = EXCLUDED.is_optional,
                metadata = COALESCE(recipe_ingredient_items_v1.metadata, '{}'::jsonb) || EXCLUDED.metadata
            """,
            (
                ingredient_group_id,
                index,
                ingredient.get("ingredient_id"),
                ingredient["raw_text"],
                ingredient.get("ingredient_name"),
                ingredient.get("quantity"),
                quantity_text,
                ingredient.get("unit"),
                ingredient.get("note"),
                bool(ingredient.get("optional")),
                Json(metadata),
            ),
        )
        summary.ingredient_items_upserted += 1


def upsert_instructions(
    cur,
    recipe_structure_id: int,
    steps: list[dict[str, Any]],
    summary: BackfillSummary,
) -> None:
    for step in steps:
        source_kind = "suggested" if step.get("source") == "suggested" else "original"
        cur.execute(
            """
            INSERT INTO recipe_instructions_v1 (
                recipe_structure_id,
                step_number,
                raw_text,
                instruction_text,
                source_kind,
                metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (recipe_structure_id, step_number, source_kind)
            DO UPDATE SET
                raw_text = EXCLUDED.raw_text,
                instruction_text = EXCLUDED.instruction_text,
                metadata = COALESCE(recipe_instructions_v1.metadata, '{}'::jsonb) || EXCLUDED.metadata
            """,
            (
                recipe_structure_id,
                step["step_number"],
                step["instruction"],
                step["instruction"],
                source_kind,
                Json(
                    {
                        "generated_by": BACKFILL_MARKER,
                        "legacy_recipe_step_id": step["id"],
                    }
                ),
            ),
        )
        summary.instructions_upserted += 1


def rebuild_document_blocks(
    cur,
    document_id: int,
    locale: str,
    recipe: dict[str, Any],
    ingredients: list[dict[str, Any]],
    steps: list[dict[str, Any]],
    summary: BackfillSummary,
) -> None:
    cur.execute(
        """
        DELETE FROM document_blocks
        WHERE document_id = %s
          AND locale = %s
          AND data_json ->> 'generated_by' = %s
        """,
        (document_id, locale, BACKFILL_MARKER),
    )

    # Reserve a high range so a rerun does not collide with future manual blocks.
    block_order = 1000
    blocks: list[tuple[Any, ...]] = []

    if recipe.get("notes"):
        blocks.append(
            (
                document_id,
                locale,
                block_order,
                "note",
                "normalized",
                recipe["notes"],
                Json({"generated_by": BACKFILL_MARKER, "role": "legacy_notes"}),
            )
        )
        block_order += 1

    for index, ingredient in enumerate(ingredients, start=1):
        blocks.append(
            (
                document_id,
                locale,
                block_order,
                "ingredient_item",
                "normalized",
                ingredient["raw_text"],
                Json(
                    {
                        "generated_by": BACKFILL_MARKER,
                        "ingredient_order": index,
                        "legacy_recipe_ingredient_id": ingredient["id"],
                    }
                ),
            )
        )
        block_order += 1

    for step in steps:
        blocks.append(
            (
                document_id,
                locale,
                block_order,
                "instruction",
                "normalized",
                step["instruction"],
                Json(
                    {
                        "generated_by": BACKFILL_MARKER,
                        "step_number": step["step_number"],
                        "legacy_recipe_step_id": step["id"],
                    }
                ),
            )
        )
        block_order += 1

    if blocks:
        cur.executemany(
            """
            INSERT INTO document_blocks (
                document_id,
                locale,
                block_order,
                block_type,
                source_mode,
                body_text,
                data_json
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            blocks,
        )
        summary.document_blocks_rebuilt += len(blocks)


def upsert_publication(cur, document_id: int, locale: str, summary: BackfillSummary) -> None:
    cur.execute(
        """
        INSERT INTO document_publications (
            document_id,
            app_key,
            publication_status,
            locale,
            is_primary,
            metadata
        )
        VALUES (%s, %s, 'draft', %s, TRUE, %s)
        ON CONFLICT (document_id, app_key, locale)
        DO UPDATE SET
            is_primary = EXCLUDED.is_primary,
            metadata = COALESCE(document_publications.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            updated_at = NOW()
        """,
        (
            document_id,
            APP_KEY,
            locale,
            Json({"generated_by": BACKFILL_MARKER}),
        ),
    )
    summary.publications_upserted += 1


def sync_sequences(cur) -> None:
    for table_name in (
        "document_sources",
        "source_assets",
        "recipe_documents",
        "recipe_document_translations",
        "document_blocks",
        "recipe_structures",
        "recipe_ingredient_groups_v1",
        "recipe_ingredient_items_v1",
        "recipe_instructions_v1",
        "document_publications",
    ):
        cur.execute(
            f"""
            SELECT setval(
                pg_get_serial_sequence(%s, 'id'),
                COALESCE((SELECT MAX(id) FROM {table_name}), 1),
                true
            )
            """,
            (table_name,),
        )


def print_summary(summary: BackfillSummary, dry_run: bool) -> None:
    print("Backfill documentaire V1")
    print(f"  Recettes lues               : {summary.recipes_seen}")
    print(f"  Recipe documents upsertes   : {summary.documents_upserted}")
    print(f"  Sources upsertees           : {summary.sources_upserted}")
    print(f"  Traductions upsertees       : {summary.translations_upserted}")
    print(f"  Groupes ingredients         : {summary.groups_upserted}")
    print(f"  Items ingredients upsertes  : {summary.ingredient_items_upserted}")
    print(f"  Instructions upsertees      : {summary.instructions_upserted}")
    print(f"  Blocs document reconstruits : {summary.document_blocks_rebuilt}")
    print(f"  Publications upsertees      : {summary.publications_upserted}")
    print("  Mode                        : dry-run (rollback)" if dry_run else "  Mode                        : commit")


def main() -> None:
    args = parse_args()
    summary = BackfillSummary()

    with get_connection() as conn:
        conn.autocommit = False
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            ensure_document_model_exists(cur)
            include_original_locale = has_recipe_column(cur, "original_locale")

            recipes = fetch_recipes(cur, args.recipe_id, include_original_locale)
            summary.recipes_seen = len(recipes)
            recipe_ids = [recipe["id"] for recipe in recipes]

            ingredients_by_recipe = fetch_ingredients(cur, recipe_ids)
            steps_by_recipe = fetch_steps(cur, recipe_ids)

            for recipe in recipes:
                source_id = upsert_document_source(cur, recipe, summary)
                document_id = upsert_recipe_document(cur, recipe, source_id, summary)
                upsert_document_translations(cur, document_id, recipe, summary)

                recipe_structure_id = upsert_recipe_structure(cur, document_id, recipe)
                group_id = upsert_default_ingredient_group(cur, recipe_structure_id, summary)

                ingredients = ingredients_by_recipe.get(recipe["id"], [])
                steps = steps_by_recipe.get(recipe["id"], [])

                upsert_ingredient_items(cur, group_id, ingredients, summary)
                upsert_instructions(cur, recipe_structure_id, steps, summary)
                rebuild_document_blocks(
                    cur,
                    document_id,
                    recipe.get("original_locale") or "fr",
                    recipe,
                    ingredients,
                    steps,
                    summary,
                )
                upsert_publication(cur, document_id, recipe.get("original_locale") or "fr", summary)

            sync_sequences(cur)
            print_summary(summary, args.dry_run)

        if args.dry_run:
            conn.rollback()
        else:
            conn.commit()


if __name__ == "__main__":
    main()
