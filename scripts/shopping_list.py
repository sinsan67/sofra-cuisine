#!/usr/bin/env python3
"""
Génère la liste de courses pour les recettes planifiées.

Usage :
    # Utiliser le plan de repas (table meal_plan)
    python scripts/shopping_list.py

    # Spécifier des recettes par id manuellement
    python scripts/shopping_list.py --ids 1 3 5

    # Spécifier les ingrédients déjà disponibles (mise à jour du garde-manger)
    python scripts/shopping_list.py --pantry "farine:500:g" "oeuf:6:pièce"

    # Voir les recettes disponibles
    python scripts/shopping_list.py --list

Options :
    --ids 1 2 3     Recettes à inclure (par id)
    --pantry        Met à jour le garde-manger avant de calculer
    --list          Liste toutes les recettes avec leur id
    --clear-plan    Vide le plan de repas après génération
"""

import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent
DB_PATH = ROOT / "db" / "cuisine.db"

CATEGORY_ORDER = ["frais", "viande", "poisson", "legumes", "fruits", "epicerie", "surgele", "autre"]
CATEGORY_LABELS = {
    "frais": "Rayon frais",
    "viande": "Viande / Charcuterie",
    "poisson": "Poisson / Fruits de mer",
    "legumes": "Fruits & Légumes",
    "fruits": "Fruits & Légumes",
    "epicerie": "Épicerie",
    "surgele": "Surgelés",
    "autre": "Divers",
}


def get_connection() -> sqlite3.Connection:
    if not DB_PATH.exists():
        sys.exit(f"Base introuvable : {DB_PATH}\nLance d'abord : python scripts/init_db.py")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def list_recipes() -> None:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, cuisine_type, dish_type, servings FROM recipes ORDER BY name"
        ).fetchall()
    if not rows:
        print("Aucune recette enregistrée.")
        return
    print(f"{'id':>4}  {'Recette':<35}  {'Cuisine':<12}  {'Type':<10}  Portions")
    print("-" * 75)
    for r in rows:
        print(f"{r['id']:>4}  {r['name']:<35}  {r['cuisine_type'] or '—':<12}  {r['dish_type'] or '—':<10}  {r['servings']}")


def update_pantry(items: list[str]) -> None:
    """Met à jour le garde-manger. Format attendu : 'nom:quantite:unite'."""
    with get_connection() as conn:
        for item in items:
            parts = item.split(":")
            if len(parts) < 2:
                print(f"  Format invalide (attendu nom:quantite:unite) : {item}")
                continue
            name = parts[0].strip().lower()
            quantity = float(parts[1]) if parts[1] else None
            unit = parts[2].strip() if len(parts) > 2 else None

            ing_row = conn.execute(
                "SELECT id FROM ingredients WHERE name = ?", (name,)
            ).fetchone()
            if not ing_row:
                print(f"  Ingrédient inconnu (à ajouter via une recette d'abord) : {name}")
                continue
            ing_id = ing_row["id"]
            conn.execute(
                """
                INSERT INTO pantry (ingredient_id, quantity, unit, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(ingredient_id) DO UPDATE SET
                    quantity   = excluded.quantity,
                    unit       = excluded.unit,
                    updated_at = excluded.updated_at
                """,
                (ing_id, quantity, unit),
            )
            print(f"  Garde-manger mis à jour : {name} = {quantity} {unit or ''}")


def build_shopping_list(recipe_ids: list[int]) -> None:
    with get_connection() as conn:
        # Noms des recettes sélectionnées
        placeholders = ",".join("?" * len(recipe_ids))
        recipes = conn.execute(
            f"SELECT id, name, servings FROM recipes WHERE id IN ({placeholders})",
            recipe_ids,
        ).fetchall()
        recipe_names = {r["id"]: r["name"] for r in recipes}

        # Agrégation des ingrédients (on ne somme que si même unité)
        rows = conn.execute(
            f"""
            SELECT
                i.name          AS ingredient,
                i.category      AS category,
                i.default_unit  AS default_unit,
                ri.quantity     AS quantity,
                ri.unit         AS unit,
                ri.optional     AS optional,
                ri.recipe_id    AS recipe_id
            FROM recipe_ingredients ri
            JOIN ingredients i ON i.id = ri.ingredient_id
            WHERE ri.recipe_id IN ({placeholders})
            ORDER BY i.category, i.name
            """,
            recipe_ids,
        ).fetchall()

        # Garde-manger
        pantry = {}
        for p in conn.execute(
            "SELECT ingredient_id, quantity, unit FROM pantry"
        ).fetchall():
            pantry[p["ingredient_id"]] = {"quantity": p["quantity"], "unit": p["unit"]}

        # Ingrédients id par nom
        ing_ids = {
            row["ingredient"]: conn.execute(
                "SELECT id FROM ingredients WHERE name = ?", (row["ingredient"],)
            ).fetchone()["id"]
            for row in rows
        }

    # Agrégation : clé = (ingredient, unit)
    totals: dict[tuple, dict] = {}
    for row in rows:
        key = (row["ingredient"], row["unit"] or row["default_unit"])
        if key not in totals:
            totals[key] = {
                "category": row["category"],
                "quantity": 0.0 if row["quantity"] is not None else None,
                "unit": row["unit"] or row["default_unit"],
                "optional": bool(row["optional"]),
                "recipes": set(),
            }
        if row["quantity"] is not None and totals[key]["quantity"] is not None:
            totals[key]["quantity"] += row["quantity"]
        totals[key]["recipes"].add(recipe_names.get(row["recipe_id"], "?"))
        if not row["optional"]:
            totals[key]["optional"] = False

    # Soustraction garde-manger
    by_category: dict[str, list] = defaultdict(list)
    in_pantry: list = []

    for (ingredient, _unit), info in totals.items():
        ing_id = ing_ids.get(ingredient)
        if ing_id and ing_id in pantry:
            p = pantry[ing_id]
            # Si même unité, on soustrait ; sinon on signale
            if info["unit"] == p["unit"] and info["quantity"] is not None and p["quantity"] is not None:
                remaining = info["quantity"] - p["quantity"]
                if remaining <= 0:
                    in_pantry.append(f"{ingredient} (déjà en stock)")
                    continue
                info["quantity"] = remaining
            else:
                info["quantity_note"] = f"({p['quantity']} {p['unit'] or ''} déjà en stock)"
        by_category[info["category"]].append((ingredient, info))

    # Affichage
    print("\n" + "=" * 50)
    print("LISTE DE COURSES")
    print("=" * 50)
    print(f"Recettes : {', '.join(recipe_names.values())}\n")

    for cat in CATEGORY_ORDER:
        items = by_category.get(cat, [])
        if not items:
            continue
        print(f"\n── {CATEGORY_LABELS[cat]} ──")
        for ingredient, info in sorted(items, key=lambda x: x[0]):
            qty = f"{info['quantity']:g} {info['unit'] or ''}".strip() if info["quantity"] is not None else "qsp"
            optional_tag = "  [optionnel]" if info["optional"] else ""
            pantry_note = f"  {info.get('quantity_note', '')}".rstrip()
            print(f"  [ ]  {ingredient:<30} {qty}{optional_tag}{pantry_note}")

    if in_pantry:
        print(f"\n── Déjà en stock ──")
        for item in sorted(in_pantry):
            print(f"  [x]  {item}")

    print("\n" + "=" * 50 + "\n")


def get_planned_recipe_ids() -> list[int]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT DISTINCT recipe_id FROM meal_plan ORDER BY planned_date"
        ).fetchall()
    return [r["recipe_id"] for r in rows]


def clear_meal_plan() -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM meal_plan")
    print("Plan de repas vidé.")


if __name__ == "__main__":
    args = sys.argv[1:]

    if "--list" in args:
        list_recipes()
        sys.exit()

    # Mise à jour garde-manger si demandé
    if "--pantry" in args:
        idx = args.index("--pantry")
        pantry_items = []
        for a in args[idx + 1:]:
            if a.startswith("--"):
                break
            pantry_items.append(a)
        update_pantry(pantry_items)

    # Récupération des ids
    if "--ids" in args:
        idx = args.index("--ids")
        recipe_ids = []
        for a in args[idx + 1:]:
            if a.startswith("--"):
                break
            try:
                recipe_ids.append(int(a))
            except ValueError:
                pass
    else:
        recipe_ids = get_planned_recipe_ids()

    if not recipe_ids:
        print("Aucune recette sélectionnée.")
        print("  • Ajoute des recettes au plan de repas (table meal_plan)")
        print("  • ou utilise --ids 1 2 3")
        sys.exit()

    build_shopping_list(recipe_ids)

    if "--clear-plan" in args:
        clear_meal_plan()
