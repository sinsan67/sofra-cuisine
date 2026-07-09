# Sofra Cuisine 🍽️

Base personnelle de recettes franco-turques, fitness et cocktails.

## Repères projet

- Projet Claude : repo local `~/Projets/cuisine` -> GitHub `sinsan67/sofra-cuisine`
- Projet Codex : repo GitHub distinct `sinsan67/sofra-cuisine-codex`
- Base de donnees partagee : une seule base Neon commune aux deux projets via `DATABASE_URL`

## Stack

- **Base partagee** : Neon PostgreSQL via `DATABASE_URL`
- **Base locale** : SQLite + Python (scripts) pour import, staging local et utilitaires
- **Site web** : Next.js App Router + TypeScript + Tailwind CSS
- **i18n** : FR · TR · EN (next-intl) — messages dans web/messages/
- **PWA** : oui (@ducanh2912/next-pwa) — installable sur mobile Android
- **DB web** : Neon PostgreSQL partagee entre Claude et Codex
- **Déploiement** : Vercel (front) + Neon (DB)

| Environnement | URL | Branche |
|---|---|---|
| Staging | https://sofra-cuisine-git-staging-ssinanusa-gmailcoms-projects.vercel.app | `staging` |
| Prod | https://sofra-cuisine.vercel.app | `main` |

## Architecture

```
cuisine/
├── db/
│   └── cuisine.db          ← base SQLite locale de travail (pas la source de vérité commune)
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
└── AGENTS.md               ← ce fichier
```

## Flux de travail — recettes

1. Sinan trouve une recette (photo, PDF, lien)
2. Il l'envoie à Codex — Codex extrait le texte et insère via `add_recipe.py --json`
3. Données en base partagee Neon pour les deux apps
4. Optionnellement, miroir ou import local SQLite selon le besoin
5. Pour la semaine : `shopping_list.py --ids X Y Z`
6. (optionnel) Note Obsidian dans `obsidian/`

## Workflow Codex

- Ajouter une recette : envoyer photo/PDF à Codex → `add_recipe.py --json '{...}'`
- Ecriture directe base partagee : `python3 scripts/add_recipe_neon.py --json '{...}'`
- Format `facets` (pas `tags`) : `{"origine": "française", "collection": "kiyma", "saison": "hiver"}`
- Ne jamais renvoyer la photo à Codex une fois la recette en base (coût inutile)
- Source de vérité commune aux apps = Neon.
- SQLite = copie locale de travail, utile pour scripts/offline/import, mais pas reference inter-projets.
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
