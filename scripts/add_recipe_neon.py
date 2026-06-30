#!/usr/bin/env python3
"""
Ajouter une recette directement dans la base Neon partagee.

Pourquoi ce script :
- Les projets Claude et Codex doivent ecrire dans la meme base distante.
- La variable DATABASE_URL reste la source de verite pour l'app web.
- Le format JSON est volontairement proche de scripts/add_recipe.py.

Usage :
    python3 scripts/add_recipe_neon.py --json '{"name": "...", ...}'

Resolution de DATABASE_URL :
1. variable d'environnement du shell
2. web/.env.local
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import psycopg2

ROOT = Path(__file__).parent.parent
ENV_PATH = ROOT / "web" / ".env.local"


def load_database_url() -> str:
    """Retourne DATABASE_URL depuis l'env ou web/.env.local."""
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    if ENV_PATH.exists():
        for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() == "DATABASE_URL":
                return value.strip().strip('"').strip("'")

    sys.exit("DATABASE_URL introuvable. Definis-la dans l'env ou dans web/.env.local")


def get_pg_conn():
    return psycopg2.connect(load_database_url())


def get_or_create_ingredient(cur, name: str, category: str = "autre", default_unit: str | None = None) -> int:
    """Retourne l'id de l'ingredient dans PostgreSQL."""
    cur.execute("SELECT id FROM ingredients WHERE name = %s", (name.lower().strip(),))
    row = cur.fetchone()
    if row:
        return row[0]

    cur.execute(
        """
        INSERT INTO ingredients (name, category, default_unit)
        VALUES (%s, %s, %s)
        RETURNING id
        """,
        (name.lower().strip(), category, default_unit),
    )
    return cur.fetchone()[0]


def add_recipe(data: dict) -> int:
    """Insere une recette complete dans Neon et retourne l'id cree."""
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO recipes
                    (name, cuisine_type, dish_type, servings, prep_time, cook_time,
                     source_url, source_file, author, notes,
                     country_code, rating, made_count, last_made)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    data["name"],
                    data.get("cuisine_type"),
                    data.get("dish_type"),
                    data.get("servings", 4),
                    data.get("prep_time"),
                    data.get("cook_time"),
                    data.get("source_url"),
                    data.get("source_file"),
                    data.get("author"),
                    data.get("notes"),
                    data.get("country_code"),
                    data.get("rating"),
                    data.get("made_count", 0),
                    data.get("last_made"),
                ),
            )
            recipe_id = cur.fetchone()[0]

            for tag_group, raw_values in (data.get("facets") or {}).items():
                values = raw_values if isinstance(raw_values, list) else [raw_values]
                for tag_value in values:
                    cur.execute(
                        """
                        INSERT INTO recipe_tags (recipe_id, tag_group, tag_value)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (recipe_id, tag_group, tag_value) DO NOTHING
                        """,
                        (recipe_id, tag_group, str(tag_value)),
                    )

            ingredient_ids: list[int] = []
            for ingredient in data.get("ingredients", []):
                ingredient_id = get_or_create_ingredient(
                    cur,
                    name=ingredient["name"],
                    category=ingredient.get("category", "autre"),
                    default_unit=ingredient.get("unit"),
                )
                ingredient_ids.append(ingredient_id)
                cur.execute(
                    """
                    INSERT INTO recipe_ingredients
                        (recipe_id, ingredient_id, quantity, unit, optional, note)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        recipe_id,
                        ingredient_id,
                        ingredient.get("quantity"),
                        ingredient.get("unit"),
                        1 if ingredient.get("optional") else 0,
                        ingredient.get("note"),
                    ),
                )

            step_ids: list[int] = []
            for index, step in enumerate(data.get("steps", []), start=1):
                if isinstance(step, dict):
                    instruction = step["instruction"]
                    source = step.get("source", "original")
                else:
                    instruction = step
                    source = "original"

                cur.execute(
                    """
                    INSERT INTO recipe_steps (recipe_id, step_number, instruction, source)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (recipe_id, index, instruction, source),
                )
                step_ids.append(cur.fetchone()[0])

            for locale, translation in (data.get("translations") or {}).items():
                cur.execute(
                    """
                    INSERT INTO recipe_translations (recipe_id, locale, name, notes)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (recipe_id, locale)
                    DO UPDATE SET name = EXCLUDED.name, notes = EXCLUDED.notes
                    """,
                    (
                        recipe_id,
                        locale,
                        translation.get("name", data["name"]),
                        translation.get("notes"),
                    ),
                )

                for ingredient_id, translated_name in zip(
                    ingredient_ids, translation.get("ingredients", [])
                ):
                    cur.execute(
                        """
                        INSERT INTO ingredient_translations (ingredient_id, locale, name)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (ingredient_id, locale)
                        DO UPDATE SET name = EXCLUDED.name
                        """,
                        (ingredient_id, locale, translated_name),
                    )

                for recipe_step_id, translated_instruction in zip(
                    step_ids, translation.get("steps", [])
                ):
                    cur.execute(
                        """
                        INSERT INTO recipe_step_translations (recipe_step_id, locale, instruction)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (recipe_step_id, locale)
                        DO UPDATE SET instruction = EXCLUDED.instruction
                        """,
                        (recipe_step_id, locale, translated_instruction),
                    )

        conn.commit()

    steps_count = len(data.get("steps", []))
    print(f'Recette ajoutee dans Neon : "{data["name"]}" (id={recipe_id}, {steps_count} etapes)')
    return recipe_id


if __name__ == "__main__":
    if "--json" not in sys.argv:
        sys.exit('Usage: python3 scripts/add_recipe_neon.py --json \'{"name": "..."}\'')

    idx = sys.argv.index("--json")
    raw = sys.argv[idx + 1]
    payload = json.loads(raw)
    add_recipe(payload)
