# Sofra Cuisine 🍽️

Base personnelle de recettes franco-turques, fitness et cocktails.

## Stack

- **Base locale** : SQLite + Python (scripts)
- **Site web** : Next.js App Router + TypeScript + Tailwind CSS
- **i18n** : FR · TR · EN (next-intl) — messages dans web/messages/
- **PWA** : oui (@ducanh2912/next-pwa) — installable sur mobile Android
- **DB web** : Neon PostgreSQL (à configurer — voir phase 4)
- **Déploiement** : Vercel (front) + Neon (DB)

| Environnement | URL | Branche |
|---|---|---|
| Staging | https://sofra-cuisine-git-staging-ssinanusa-gmailcoms-projects.vercel.app | `staging` |
| Prod | https://sofra-cuisine.vercel.app | `main` |

## Architecture

```
cuisine/
├── db/
│   └── cuisine.db          ← base SQLite locale (source de vérité Python)
├── scripts/
│   ├── init_db.py          ← crée ou recrée la base
│   ├── add_recipe.py       ← ajoute une recette (--json ou interactif)
│   ├── shopping_list.py    ← génère la liste de courses
│   └── migrate_facets.py   ← migration tags → facettes (S005, fait)
├── web/                    ← site Next.js App Router
│   ├── src/app/            ← pages et layouts
│   ├── messages/           ← traductions FR/TR/EN (next-intl)
│   └── public/manifest.json
├── sources/                ← photos et PDFs originaux des recettes
├── schema.sql              ← schéma SQLite de référence
└── CLAUDE.md               ← ce fichier
```

## Flux de travail — recettes

1. Sinan trouve une recette (photo, PDF, lien)
2. Il l'envoie à Claude — Claude extrait le texte et insère via `add_recipe.py --json`
3. Données en base SQLite + fichier source dans `sources/`
4. Pour la semaine : `shopping_list.py --ids X Y Z`
5. (optionnel) Note Obsidian dans `obsidian/`

## Workflow Claude

- Ajouter une recette : envoyer photo/PDF à Claude → `add_recipe.py --json '{...}'`
- Format `facets` (pas `tags`) : `{"origine": "française", "collection": "kiyma", "saison": "hiver"}`
- Ne jamais renvoyer la photo à Claude une fois la recette en base (coût inutile)
- Source de vérité locale = SQLite. Site web = Neon (à migrer).
- Push par défaut → `staging`. Jamais `main` sans confirmation.

## Schéma DB (tables SQLite)

| Table               | Rôle                                              |
|---------------------|---------------------------------------------------|
| recipes             | Une ligne par recette                             |
| ingredients         | Référentiel des ingrédients (nom + catégorie)     |
| recipe_ingredients  | Quantités par recette (table pivot)               |
| recipe_tags         | Tags à facettes (tag_group, tag_value) — S005     |
| recipe_steps        | Étapes (source: original/suggested)               |
| meal_plan           | Recettes planifiées pour la semaine               |
| pantry              | Ingrédients déjà disponibles (garde-manger)       |

## Commandes utiles

```bash
# Lister toutes les recettes
python3 scripts/shopping_list.py --list

# Ajouter une recette en mode interactif
python3 scripts/add_recipe.py

# Générer la liste de courses pour les recettes 1, 3 et 5
python3 scripts/shopping_list.py --ids 1 3 5

# Recréer la base (DANGER : efface tout)
python3 scripts/init_db.py --reset

# Lancer le dev web
cd web && npm run dev
```

## Décisions prises

- Bootstrap S001 : SQLite + Python scripts
- S003 : étapes recipe_steps avec source original/suggested
- S005 : tags à facettes (recipe_tags) — 9 groupes, 101 facettes sur 21 recettes
- S005 : scaffold web Next.js App Router + i18n (FR/TR/EN) + PWA
