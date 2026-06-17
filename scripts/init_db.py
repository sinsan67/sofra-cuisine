#!/usr/bin/env python3
"""
Initialise la base de données SQLite depuis schema.sql.
Crée db/cuisine.db s'il n'existe pas, ou le recrée si --reset est passé.

Usage :
    python scripts/init_db.py           # création initiale (safe)
    python scripts/init_db.py --reset   # supprime et recrée (toutes les données perdues !)
"""

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DB_PATH = ROOT / "db" / "cuisine.db"
SCHEMA_PATH = ROOT / "schema.sql"


def init(reset: bool = False) -> None:
    if reset and DB_PATH.exists():
        confirm = input(f"Supprimer {DB_PATH} et repartir de zéro ? [oui/N] ").strip().lower()
        if confirm != "oui":
            print("Annulé.")
            return
        DB_PATH.unlink()
        print("Base supprimée.")

    if DB_PATH.exists() and not reset:
        print(f"Base déjà existante : {DB_PATH}")
        print("Passe --reset pour la recréer (attention : toutes les données seront perdues).")
        return

    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(schema)

    print(f"Base créée : {DB_PATH}")
    print("Tables disponibles :")
    with sqlite3.connect(DB_PATH) as conn:
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        for (t,) in tables:
            print(f"  - {t}")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    init(reset=reset)
