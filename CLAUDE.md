# Projet — Cuisine

## Objectif

Créer une base personnelle de recettes de cuisine :
- Organiser les recettes trouvées (liens, photos, sources)
- Garder une trace des plats réalisés (photos, notes)
- Générer des listes de courses depuis un plan de repas hebdomadaire

## État

Structure mise en place (2026-06-17). Base de données initialisée. Zéro recette pour l'instant.

## Architecture

```
cuisine/
├── db/
│   └── cuisine.db       ← base SQLite (source de vérité)
├── scripts/
│   ├── init_db.py       ← crée ou recrée la base
│   ├── add_recipe.py    ← ajoute une recette (interactif ou --json)
│   └── shopping_list.py ← génère la liste de courses
├── sources/             ← photos et PDFs originaux des recettes
├── obsidian/            ← notes .md générées pour Obsidian (lecture seule)
├── recettes/            ← (dossier existant, usage à définir)
└── schema.sql           ← schéma de la base
```

## Flux de travail

1. Sinan trouve une recette (photo, PDF, lien)
2. Il l'envoie à Claude — Claude extrait le texte et l'insère via `add_recipe.py --json`
3. La recette est en base (texte structuré) + le fichier source dans `sources/`
4. Pour la semaine : Sinan liste les recettes voulues → `shopping_list.py --ids X Y Z`
5. (optionnel) Génération d'une note Obsidian par recette dans `obsidian/`

## Workflow Claude

- Pour ajouter une recette depuis une photo/PDF : envoyer le fichier à Claude,
  Claude en extrait le texte et lance `add_recipe.py --json '{...}'`
- Ne jamais renvoyer la photo à Claude une fois la recette en base (coût inutile)
- Source de vérité = base SQLite. Obsidian = lecture seule générée.

## Schéma DB (tables)

| Table               | Rôle                                              |
|---------------------|---------------------------------------------------|
| recipes             | Une ligne par recette                             |
| ingredients         | Référentiel des ingrédients (nom + catégorie)     |
| recipe_ingredients  | Quantités par recette (table pivot)               |
| meal_plan           | Recettes planifiées pour la semaine               |
| pantry              | Ingrédients déjà disponibles (garde-manger)       |

## Commandes utiles

```bash
# Lister toutes les recettes
python scripts/shopping_list.py --list

# Ajouter une recette en mode interactif
python scripts/add_recipe.py

# Générer la liste de courses pour les recettes 1, 3 et 5
python scripts/shopping_list.py --ids 1 3 5

# Recréer la base (DANGER : efface tout)
python scripts/init_db.py --reset
```

## À définir

- Générer les notes Obsidian automatiquement (script `generate_obsidian.py`)
- Types de cuisine et tags standards à utiliser
- Utilisation du dossier `recettes/` (déjà existant)
