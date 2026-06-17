#!/usr/bin/env python3
"""
Ajouter une recette à la base de données.

Usage interactif :
    python scripts/add_recipe.py

Usage non-interactif (depuis Claude) :
    python scripts/add_recipe.py --json '{"name": "...", ...}'

Format JSON complet :
{
  "name": "Tarte aux tomates",
  "dish_type": "plat",
  "servings": 4,
  "prep_time": 20,
  "cook_time": 30,
  "source_url": "https://...",
  "source_file": "sources/tarte-tomates.jpg",
  "author": "maman",
  "country_code": "FR",
  "notes": "Ajouter du basilic frais à la sortie du four.",
  "facets": {
    "origine": "française",
    "collection": "classique",
    "saison": "été",
    "regime": ["végétarien", "sans-gluten"]
  },
  "ingredients": [
    {"name": "pâte brisée", "category": "epicerie", "quantity": 1, "unit": "pièce"},
    {"name": "tomate", "category": "legumes", "quantity": 4, "unit": "pièce"},
    {"name": "basilic frais", "category": "legumes", "quantity": null, "unit": null, "optional": true}
  ],
  "steps": [
    {"instruction": "Préchauffer le four à 180°C.", "source": "original"},
    {"instruction": "Étaler la pâte dans un moule.", "source": "original"}
  ]
}
"""

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DB_PATH = ROOT / "db" / "cuisine.db"


def get_or_create_ingredient(
    conn: sqlite3.Connection,
    name: str,
    category: str = "autre",
    default_unit: str | None = None,
) -> int:
    """Retourne l'id de l'ingrédient (le crée s'il n'existe pas)."""
    row = conn.execute(
        "SELECT id FROM ingredients WHERE name = ?", (name.lower().strip(),)
    ).fetchone()
    if row:
        return row[0]
    cur = conn.execute(
        "INSERT INTO ingredients (name, category, default_unit) VALUES (?, ?, ?)",
        (name.lower().strip(), category, default_unit),
    )
    return cur.lastrowid


def add_recipe(data: dict) -> int:
    """Insère une recette complète dans la base. Retourne l'id créé."""
    if not DB_PATH.exists():
        sys.exit(f"Base introuvable : {DB_PATH}\nLance d'abord : python scripts/init_db.py")

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")

        cur = conn.execute(
            """
            INSERT INTO recipes
                (name, cuisine_type, dish_type, servings, prep_time, cook_time,
                 source_url, source_file, author, notes,
                 country_code, rating, made_count, last_made)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        recipe_id = cur.lastrowid

        for tag_group, raw_values in (data.get("facets") or {}).items():
            values = raw_values if isinstance(raw_values, list) else [raw_values]
            for tag_value in values:
                conn.execute(
                    "INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_group, tag_value) VALUES (?, ?, ?)",
                    (recipe_id, tag_group, str(tag_value)),
                )

        for ing in data.get("ingredients", []):
            ingredient_id = get_or_create_ingredient(
                conn,
                name=ing["name"],
                category=ing.get("category", "autre"),
                default_unit=ing.get("unit"),
            )
            conn.execute(
                """
                INSERT INTO recipe_ingredients
                    (recipe_id, ingredient_id, quantity, unit, optional, note)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    recipe_id,
                    ingredient_id,
                    ing.get("quantity"),
                    ing.get("unit"),
                    1 if ing.get("optional") else 0,
                    ing.get("note"),
                ),
            )

        for i, step in enumerate(data.get("steps", []), start=1):
            if isinstance(step, dict):
                instruction = step["instruction"]
                source = step.get("source", "original")
            else:
                instruction = step
                source = "original"
            conn.execute(
                "INSERT INTO recipe_steps (recipe_id, step_number, instruction, source) VALUES (?, ?, ?, ?)",
                (recipe_id, i, instruction, source),
            )

        steps_count = len(data.get("steps", []))
        print(f"Recette ajoutée : \"{data['name']}\" (id={recipe_id}, {steps_count} étapes)")
        return recipe_id


def interactive_mode() -> None:
    """Saisie guidée en ligne de commande."""
    print("=== Ajouter une recette ===\n")
    data: dict = {}

    data["name"] = input("Nom de la recette : ").strip()
    data["cuisine_type"] = input("Type de cuisine (française/italienne/...) : ").strip() or None
    data["dish_type"] = input("Type de plat (plat/entrée/dessert/sauce/...) : ").strip() or None
    data["servings"] = int(input("Portions (défaut 4) : ").strip() or 4)
    prep = input("Temps de préparation en minutes (optionnel) : ").strip()
    data["prep_time"] = int(prep) if prep else None
    cook = input("Temps de cuisson en minutes (optionnel) : ").strip()
    data["cook_time"] = int(cook) if cook else None
    data["source_url"] = input("URL source (optionnel) : ").strip() or None
    data["source_file"] = input("Fichier source relatif, ex. sources/recette.jpg (optionnel) : ").strip() or None
    data["author"] = input("Auteur de la recette (optionnel, ex. maman, slr) : ").strip() or None
    data["tags"] = input("Tags séparés par virgule (rapide,végétarien,...) : ").strip() or None
    data["notes"] = input("Notes personnelles (optionnel) : ").strip() or None

    CATEGORIES = ["epicerie", "frais", "viande", "poisson", "legumes", "fruits", "surgele", "autre"]
    print(f"\nCatégories disponibles : {', '.join(CATEGORIES)}")
    print("Ingrédients (ligne vide pour terminer) :")

    ingredients = []
    while True:
        name = input("  Ingrédient : ").strip()
        if not name:
            break
        qty_raw = input("    Quantité (optionnel) : ").strip()
        quantity = float(qty_raw) if qty_raw else None
        unit = input("    Unité (g/ml/pièce/c. à soupe/...) : ").strip() or None
        category = input(f"    Catégorie (défaut: autre) : ").strip() or "autre"
        optional_raw = input("    Optionnel ? (o/N) : ").strip().lower()
        note = input("    Note (ex. émincé, optionnel) : ").strip() or None
        ingredients.append({
            "name": name,
            "quantity": quantity,
            "unit": unit,
            "category": category,
            "optional": optional_raw == "o",
            "note": note,
        })

    data["ingredients"] = ingredients
    add_recipe(data)


if __name__ == "__main__":
    if "--json" in sys.argv:
        idx = sys.argv.index("--json")
        raw = sys.argv[idx + 1]
        data = json.loads(raw)
        add_recipe(data)
    else:
        interactive_mode()
