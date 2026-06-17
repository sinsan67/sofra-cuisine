#!/usr/bin/env python3
"""
Migration S005 — tags texte libre → recipe_tags à facettes.

Crée la table recipe_tags et y déplace les données de :
  - cuisine_type (colonne recipes)
  - tags         (colonne recipes, virgule-séparée)
  - country_code (colonne recipes, pour l'origine quand cuisine_type ne la couvre pas)

Usage :
    python scripts/migrate_facets.py
    python scripts/migrate_facets.py --dry-run
"""

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DB_PATH = ROOT / "db" / "cuisine.db"

# cuisine_type → liste de (tag_group, tag_value)
CUISINE_TYPE_FACETS: dict[str, list[tuple[str, str]]] = {
    "française":  [("origine", "française")],
    "turque":     [("origine", "turque"), ("collection", "kiyma")],
    "fitness":    [("collection", "fitness")],
    "cocktail":   [("collection", "cocktail")],
    "ottolenghi": [("collection", "ottolenghi")],
}

# country_code → origine (utilisé seulement si pas déjà couvert par cuisine_type)
COUNTRY_ORIGINE: dict[str, str] = {
    "FR": "française",
    "TR": "turque",
    "GR": "grecque",
    "IT": "italienne",
}

# tag libre → (tag_group, tag_value normalisé) ; None = ignorer (redondant)
TAG_MAP: dict[str, tuple[str, str] | None] = {
    # Redondants avec cuisine_type → collection
    "turc": None, "kiyma": None, "base": None,
    "fitness": None, "cocktail": None, "ottolenghi": None,
    # Redondants avec dish_type ou name
    "dessert": None, "gâteau": None, "tarte": None,
    # Ingrédients trop génériques
    "légumes": None, "épinards": None, "poireaux": None, "chou-fleur": None,
    "sirop": None, "mexique": None,

    # Saison
    "été":   ("saison", "été"),
    "hiver": ("saison", "hiver"),

    # Caractère
    "réconfortant":  ("caractere", "réconfortant"),
    "rapide":        ("caractere", "rapide"),
    "sans-cuisson":  ("caractere", "sans-cuisson"),
    "leger":         ("caractere", "léger"),
    "alcool":        ("caractere", "alcool"),
    "rafraichissant":("caractere", "rafraîchissant"),
    "fruité":        ("caractere", "fruité"),
    "visuel":        ("caractere", "visuel"),

    # Régime
    "végétarien":  ("regime", "végétarien"),
    "vegan":       ("regime", "vegan"),
    "sans-gluten": ("regime", "sans-gluten"),

    # Occasion
    "aperitif":    ("occasion", "apéritif"),
    "festif":      ("occasion", "festif"),
    "goûter":      ("occasion", "goûter"),
    "anniversaire":("occasion", "anniversaire"),

    # Événement
    "strasbourg-juin-2026": ("evenement", "strasbourg-juin-2026"),

    # Ingrédient clé (signature du plat)
    "fromage":       ("ingredient-cle", "fromage"),
    "fromage-fondu": ("ingredient-cle", "fromage-fondu"),
    "tomate":        ("ingredient-cle", "tomate"),
    "mastic":        ("ingredient-cle", "mastic"),
    "chios":         ("ingredient-cle", "chios"),
    "miso":          ("ingredient-cle", "miso"),
    "zaatar":        ("ingredient-cle", "zaatar"),
    "piment":        ("ingredient-cle", "piment"),
    "noix":          ("ingredient-cle", "noix"),
    "daikon":        ("ingredient-cle", "daikon"),
    "chou-rave":     ("ingredient-cle", "chou-rave"),

    # Style culinaire
    "asiatique": ("style", "asiatique"),
    "dim-sum":   ("style", "dim-sum"),
    "levant":    ("origine", "levantine"),
}


def build_facets(
    cuisine_type: str | None,
    tags_raw: str | None,
    country_code: str | None,
) -> list[tuple[str, str]]:
    """Retourne la liste dédupliquée de (tag_group, tag_value) pour une recette."""
    seen: set[tuple[str, str]] = set()
    result: list[tuple[str, str]] = []

    def add(group: str, value: str) -> None:
        pair = (group, value)
        if pair not in seen:
            seen.add(pair)
            result.append(pair)

    # 1. cuisine_type
    if cuisine_type and cuisine_type in CUISINE_TYPE_FACETS:
        for g, v in CUISINE_TYPE_FACETS[cuisine_type]:
            add(g, v)

    # 2. country_code → origine (si pas déjà présente via cuisine_type)
    if country_code and country_code in COUNTRY_ORIGINE:
        add("origine", COUNTRY_ORIGINE[country_code])

    # 3. tags libres
    if tags_raw:
        for raw_tag in tags_raw.split(","):
            tag = raw_tag.strip()
            if not tag:
                continue
            if tag in TAG_MAP:
                mapped = TAG_MAP[tag]
                if mapped is not None:
                    add(mapped[0], mapped[1])
            else:
                # Tag inconnu : on le conserve dans groupe "autre" pour ne rien perdre
                add("autre", tag)

    return result


def run(dry_run: bool = False) -> None:
    if not DB_PATH.exists():
        sys.exit(f"Base introuvable : {DB_PATH}")

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")

        # Créer la table si absente
        conn.execute("""
            CREATE TABLE IF NOT EXISTS recipe_tags (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                tag_group  TEXT NOT NULL,
                tag_value  TEXT NOT NULL,
                UNIQUE (recipe_id, tag_group, tag_value)
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe ON recipe_tags(recipe_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_recipe_tags_group_value ON recipe_tags(tag_group, tag_value)"
        )

        recipes = conn.execute(
            "SELECT id, name, cuisine_type, tags, country_code FROM recipes ORDER BY id"
        ).fetchall()

        total_inserted = 0
        unknown_tags: set[str] = set()

        for recipe_id, name, cuisine_type, tags_raw, country_code in recipes:
            facets = build_facets(cuisine_type, tags_raw, country_code)

            print(f"\n  #{recipe_id} {name}")
            for g, v in facets:
                print(f"    [{g}] {v}")
                if not dry_run:
                    conn.execute(
                        "INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_group, tag_value) VALUES (?, ?, ?)",
                        (recipe_id, g, v),
                    )
                    total_inserted += 1

            # Détecter tags non mappés (groupe "autre")
            for g, v in facets:
                if g == "autre":
                    unknown_tags.add(v)

        if dry_run:
            print(f"\n[DRY RUN] Aucune insertion effectuée.")
        else:
            print(f"\n{total_inserted} facettes insérées dans recipe_tags.")

        if unknown_tags:
            print(f"\nTags non mappés (conservés dans groupe 'autre') : {sorted(unknown_tags)}")

        if not dry_run:
            conn.commit()
            count = conn.execute("SELECT COUNT(*) FROM recipe_tags").fetchone()[0]
            print(f"Total recipe_tags en base : {count}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("=== DRY RUN — aucune écriture ===\n")
    else:
        print("=== Migration tags → facettes ===\n")
    run(dry_run=dry_run)
