"""
Seed Neon PostgreSQL depuis la base SQLite locale.

Prérequis:
  pip3 install psycopg2-binary

Usage:
  DATABASE_URL='postgresql://...' python3 scripts/seed_neon.py

Le script insère toutes les données existantes (21 recettes + ingrédients +
étapes + tags). Les ID SQLite sont conservés ; les séquences sont resynchronisées
après l'import. Idempotent : ON CONFLICT DO NOTHING.
"""

import sqlite3
import sys
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "db" / "cuisine.db"


def get_pg_conn():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Erreur : variable DATABASE_URL manquante.")
        print("Usage: DATABASE_URL='postgresql://...' python3 scripts/seed_neon.py")
        sys.exit(1)
    try:
        import psycopg2
        return psycopg2.connect(url)
    except ImportError:
        print("Erreur : psycopg2 non installé. Lancer : pip3 install psycopg2-binary")
        sys.exit(1)


def main():
    print(f"Source SQLite : {DB_PATH}")
    if not DB_PATH.exists():
        print("Erreur : base SQLite introuvable.")
        sys.exit(1)

    sqlite = sqlite3.connect(str(DB_PATH))
    sqlite.row_factory = sqlite3.Row

    print("Connexion Neon…")
    pg = get_pg_conn()
    pg.autocommit = False
    cur = pg.cursor()

    try:
        # ── ingredients ───────────────────────────────────────────────────────
        rows = sqlite.execute(
            "SELECT id, name, category, default_unit FROM ingredients"
        ).fetchall()
        if rows:
            cur.executemany(
                """
                INSERT INTO ingredients (id, name, category, default_unit)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (name) DO NOTHING
                """,
                [tuple(r) for r in rows],
            )
            cur.execute(
                "SELECT setval('ingredients_id_seq', (SELECT MAX(id) FROM ingredients))"
            )
            print(f"  {len(rows)} ingrédients")

        # ── recipes ───────────────────────────────────────────────────────────
        rows = sqlite.execute(
            """
            SELECT id, name, cuisine_type, dish_type, servings, prep_time, cook_time,
                   source_url, source_file, author, notes, rating, made_count, last_made,
                   tags, country_code, created_at
            FROM recipes
            """
        ).fetchall()
        cur.executemany(
            """
            INSERT INTO recipes (
                id, name, cuisine_type, dish_type, servings, prep_time, cook_time,
                source_url, source_file, author, notes, rating, made_count, last_made,
                tags, country_code, created_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO NOTHING
            """,
            [tuple(r) for r in rows],
        )
        cur.execute(
            "SELECT setval('recipes_id_seq', (SELECT MAX(id) FROM recipes))"
        )
        print(f"  {len(rows)} recettes")

        # ── recipe_ingredients ────────────────────────────────────────────────
        rows = sqlite.execute(
            "SELECT id, recipe_id, ingredient_id, quantity, unit, optional, note FROM recipe_ingredients"
        ).fetchall()
        if rows:
            cur.executemany(
                """
                INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, optional, note)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (id) DO NOTHING
                """,
                [tuple(r) for r in rows],
            )
            cur.execute(
                "SELECT setval('recipe_ingredients_id_seq', (SELECT MAX(id) FROM recipe_ingredients))"
            )
            print(f"  {len(rows)} lignes recipe_ingredients")

        # ── recipe_steps ──────────────────────────────────────────────────────
        rows = sqlite.execute(
            "SELECT id, recipe_id, step_number, instruction, source FROM recipe_steps"
        ).fetchall()
        if rows:
            cur.executemany(
                """
                INSERT INTO recipe_steps (id, recipe_id, step_number, instruction, source)
                VALUES (%s,%s,%s,%s,%s)
                ON CONFLICT (id) DO NOTHING
                """,
                [tuple(r) for r in rows],
            )
            cur.execute(
                "SELECT setval('recipe_steps_id_seq', (SELECT MAX(id) FROM recipe_steps))"
            )
            print(f"  {len(rows)} étapes")

        # ── recipe_tags ───────────────────────────────────────────────────────
        rows = sqlite.execute(
            "SELECT id, recipe_id, tag_group, tag_value FROM recipe_tags"
        ).fetchall()
        if rows:
            cur.executemany(
                """
                INSERT INTO recipe_tags (id, recipe_id, tag_group, tag_value)
                VALUES (%s,%s,%s,%s)
                ON CONFLICT DO NOTHING
                """,
                [tuple(r) for r in rows],
            )
            cur.execute(
                "SELECT setval('recipe_tags_id_seq', (SELECT MAX(id) FROM recipe_tags))"
            )
            print(f"  {len(rows)} tags")

        pg.commit()
        print("\nSeed terminé.")

    except Exception as e:
        pg.rollback()
        print(f"Erreur : {e}")
        raise
    finally:
        sqlite.close()
        pg.close()


if __name__ == "__main__":
    main()
