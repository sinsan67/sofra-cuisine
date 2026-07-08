# PRD — Sofra Cuisine

**Version** : 1.2 · Juillet 2026  
**Statut** : En cours de développement  

---

## Vision

Sofra est un carnet de cuisine vivant — conçu pour être partagé avec un cercle proche, pas seulement pour un usage solitaire. Un espace où les recettes personnelles côtoient les grandes cuisines du monde, où l'on peut noter une idée le soir en rentrant du marché, lier une inspiration à une recette existante, et retrouver en quelques secondes ce plat qu'on a fait il y a trois mois. Ni une application généraliste, ni un livre fermé : un objet éditorial vivant, pensé pour durer et pour grandir.

---

## Utilisateurs

**Sinan** — curateur principal. Il alimente la base, organise les recettes, écrit les notes, décide de ce qui est visible.

**Cercle proche** — famille, amis, proches à qui il partage le site. Ils consultent, explorent, cuisinent à partir des recettes. Ils peuvent potentiellement laisser une note ou un retour (à définir).

Le site est ouvert à la consultation — pas besoin de créer un compte pour lire. L'édition reste réservée au curateur.

---

## Échelle visée

- **1 000+ recettes** à terme, issues de plusieurs univers culinaires
- **Origines multiples** : française, turque, levantine, grecque, asiatique, méditerranéenne...
- **Collections thématiques** : recettes de famille, fitness, cocktails, chefs (Ottolenghi, Gaudry...), voyages
- **Labels variés** : régime, caractère, saison, occasion, ingrédient-clé
- **Langues** : français, turc, anglais — chaque recette accessible dans les trois langues

---

## Principes de design

### Épuré avant tout

Pas de barre latérale encombrée, pas de dashboard avec des widgets. Une page = un usage. La hiérarchie visuelle fait tout le travail. Fond clair, typographie lisible, une couleur d'accent chaleureuse (ocre, terre cuite ou vert sauge). Aucune décoration gratuite.

### Typography-first

Les recettes sont du texte structuré. Ingrédients, étapes, notes — tout doit être lisible d'un coup d'œil à distance, sur un écran lumineux en cuisine. Taille de police généreuse, interlignage respirant, contraste fort.

### Les photos comme révélateur, pas comme décoration

Quand les photos accompagnent une recette, elles amplifient l'envie — elles ne remplissent pas l'espace. Format compact en tête de fiche, bien cadré. Pas de carrousel, pas de galerie pleine page.

### Une seule action évidente par écran

Liste → cliquer sur une recette. Fiche → lire ou cuisiner. Pas de menus cachés, pas d'options qui se multiplient.

### Navigabilité visuelle — les tags comme premier langage

Les tags à facettes ne sont pas un filtre technique caché dans un dropdown : ce sont des **objets visuels cliquables**, affichés en permanence, avec un emoji d'ancrage par catégorie. On navigue dans Sofra comme on associe des idées, pas comme on remplit un formulaire de recherche.

Exemple : taper mentalement "Turquie + aubergine + maman" → cliquer 🇹🇷 + 🍆 + 👩 → les recettes qui correspondent apparaissent immédiatement. C'est de la navigation par association, pas du filtrage par case à cocher.

---

## Fonctionnalités

### Exploration des recettes

- **Tags visuels cliquables** affichés en permanence, organisés par groupe avec un emoji d'ancrage par catégorie (voir tableau ci-dessous)
- Combinaison libre de tags : activer 🇹🇷 + 🍆 + 👩 filtre instantanément les recettes turques à l'aubergine de la collection famille
- Recherche plein texte dans les titres, ingrédients et notes
- Tri par note, date d'ajout, nombre de réalisations

**Emoji par groupe de tags :**

| Groupe | Emoji | Exemples de valeurs |
|--------|-------|---------------------|
| `origine` | 🌍 + drapeau (🇫🇷 🇹🇷 🇬🇷) | française · turque · grecque · levantine |
| `collection` | 📚 | fitness · cocktail · ottolenghi · classique |
| `famille` | 👩 | kiyma · maman · base |
| `caractere` | ✨ | réconfortant · léger · festif · rapide |
| `regime` | 🥦 | végétarien · sans-gluten · riche-proteines |
| `saison` | 🌸 | printemps · été · automne · hiver |
| `ingredient-cle` | 🧄 | mastic · aubergine · chios |
| `evenement` | 📅 | strasbourg-juin-2026 |
| `style` | 🎨 | (libre) |

### Fiche recette

- Ingrédients avec quantités (et mention "au goût" si non spécifié)
- Étapes numérotées — avec distinction visible entre étapes originales et étapes enrichies
- Note personnelle et rating (1 à 5)
- Nombre de fois réalisée + date de dernière réalisation
- Photo(s) si disponible(s)
- Tags / labels associés (origine, collection, caractère, régime...)
- Recettes liées (ex. : la sauce kiyma de base liée aux plats dérivés)

### Carnet d'idées

Un espace séparé de la liste de recettes — plus libre, plus personnel.

- **Notes datées** : prendre une note rapide (idée de plat, observation en cuisine, inspiration du marché), avec date automatique
- **Liens vers des recettes** : lier une note à une ou plusieurs recettes existantes ("j'ai essayé ça avec la recette 12, voilà ce que j'ai changé")
- **Brouillons** : une idée de recette pas encore formalisée peut vivre ici avant d'être convertie en fiche complète
- **Filtrable par date** : retrouver ce qu'on a noté ce mois-ci, la semaine passée

### Liste de courses

- Sélectionner plusieurs recettes → générer la liste de courses consolidée
- Regroupement par catégorie d'ingrédient (épicerie, frais, viande, légumes...)
- Soustraction du garde-manger (ingrédients déjà disponibles)

### Planification (meal planning)

- Associer des recettes à des jours de la semaine
- Vue hebdomadaire simple
- Génération automatique de la liste de courses depuis le planning

### Accessibilité mobile

- Site responsive, lisible sur smartphone en cuisine
- Installable sur l'écran d'accueil (Android)
- Pages recettes disponibles hors-ligne une fois visitées

---

## Ce que Sofra ne fait pas

- Pas de génération de recettes par IA — Sofra stocke, organise et affiche
- Pas de réseau social ni de fonctionnalités communautaires
- Pas de calcul de valeurs nutritionnelles
- Pas de commande en ligne ou d'intégration e-commerce

---

## Métriques de succès

Pour un projet de cette nature, les indicateurs sont qualitatifs et comportementaux :

- Les proches ouvrent le site avant de cuisiner plutôt que de chercher sur Marmiton
- Sinan y ajoute régulièrement de nouvelles recettes et notes sans friction
- Une recette se trouve en moins de 10 secondes
- La liste de courses est générée depuis le web, sans passer par le terminal
- Le site donne envie d'explorer même sans intention de cuisiner immédiatement

---

## Roadmap par horizon

### Maintenant (S009-S010)
- Afficher rating + notes sur la fiche recette
- Recherche plein texte
- **Navigation par tags visuels** (chips cliquables avec emojis, combinables)
- Liste de courses dans le web (interface utilisateur)

### Prochain sprint
- Carnet d'idées — notes datées avec liens vers recettes
- Photos sur les fiches
- Validation complète du flux admin d'import (login, revue, écriture en base)

### Plus tard
- Meal planning hebdomadaire dans le web
- Ajout de recette depuis le web (formulaire curateur)
- Mode "en cuisine" : écran épuré, étapes une par une

### Vision long terme
- Accès multi-utilisateurs (lecture publique, curateur identifié)
- Export PDF (recette individuelle ou sélection)
- Versions multilingues complètes (traductions des recettes, pas seulement de l'interface)

---

## Onboarding agent / Codex

> **Note de sécurité** : ce fichier est dans un repo public. Aucune clé, mot de passe ou connection string ne figure ici. Les secrets sont à injecter via le gestionnaire de secrets de l'agent (variables d'environnement).

### Repo & déploiement

| Élément | Valeur |
|---|---|
| GitHub | `https://github.com/sinsan67/sofra-cuisine` (public) |
| Branche prod | `main` → Vercel prod |
| Branche staging | `staging` → Vercel staging |
| URL prod | `https://sofra-cuisine.vercel.app` |
| URL staging | `https://sofra-cuisine-git-staging-ssinanusa-gmailcoms-projects.vercel.app` |
| Vercel rootDirectory | `web/` |

### Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js App Router | 15.x |
| Langage | TypeScript | strict |
| Style | Tailwind CSS | v4 |
| i18n | next-intl | v4 — FR / TR / EN |
| PWA | @ducanh2912/next-pwa | installé, cache offline à configurer |
| Base de données web | Neon PostgreSQL | serverless (`@neondatabase/serverless`) |
| Base de données locale | SQLite | scripts Python uniquement |
| ORM / queries | SQL brut | `web/src/lib/queries.ts` |
| Runtime | Node.js | 20+ |

### Infrastructure partagée

Ce projet utilise une **base de données Neon partagée** entre les deux implémentations (Claude et Codex). La même `DATABASE_URL` donne accès aux mêmes données.

Règles pour toute nouvelle implémentation :
- **Lire** les données librement
- **Ne pas modifier le schéma** sans coordination — les deux apps lisent les mêmes tables
- **Ne pas vider ou re-seeder** la base sans accord explicite
- Créer un **nouveau repo GitHub** et un **nouveau projet Vercel** (ne pas toucher à `sinsan67/sofra-cuisine`)

### Variables d'environnement requises

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connection string Neon PostgreSQL (pooler) — fournie directement dans le prompt de démarrage |
| `ADMIN_IMPORT_PASSWORD` | Mot de passe serveur léger pour la route privée `/admin/import` (Preview + Production si activé) |

À injecter dans : `.env.local` (dev local) + Vercel env vars (staging + prod).

### Architecture fichiers clés

```
cuisine/
├── web/                          ← racine Next.js (Vercel rootDirectory)
│   ├── src/
│   │   ├── app/[locale]/         ← pages App Router avec routing i18n
│   │   │   ├── page.tsx          ← home
│   │   │   ├── recettes/
│   │   │   │   ├── page.tsx      ← liste des recettes
│   │   │   │   └── [id]/page.tsx ← fiche recette
│   │   ├── lib/
│   │   │   ├── db.ts             ← client Neon
│   │   │   └── queries.ts        ← getAllRecipes(), getRecipeById()
│   │   └── i18n/
│   │       └── routing.ts        ← locales FR/TR/EN
│   ├── messages/                 ← traductions {fr,tr,en}.json
│   └── public/manifest.json      ← PWA manifest
├── scripts/                      ← scripts Python (source de vérité locale)
│   ├── add_recipe.py             ← ajouter une recette
│   ├── shopping_list.py          ← liste de courses
│   └── seed_neon.py              ← seeder Neon depuis SQLite
├── db/cuisine.db                 ← SQLite local (21 recettes actuellement)
└── schema.sql                    ← schéma SQLite de référence
```

### Schéma PostgreSQL (tables principales)

| Table | Rôle |
|---|---|
| `recipes` | Une ligne par recette (titre, rating, dish_type, country_code...) |
| `ingredients` | Référentiel ingrédients (nom + catégorie) |
| `recipe_ingredients` | Pivot recette ↔ ingrédient (quantité, unité) |
| `recipe_steps` | Étapes numérotées — champ `source`: `original` ou `suggested` |
| `recipe_tags` | Tags à facettes : `(recipe_id, tag_group, tag_value)` |
| `meal_plan` | Planification hebdomadaire |
| `pantry` | Garde-manger (ingrédients disponibles) |

**Groupes de tags disponibles** : `origine` · `collection` · `caractere` · `regime` · `famille` · `evenement` · `ingredient-cle` · `saison` · `style`

### État actuel (juillet 2026)

- 21 recettes en base (Neon + SQLite synchronisés)
- Pages `/`, `/recettes`, `/recettes/[id]` fonctionnelles et déployées
- i18n routing opérationnel, traductions FR partielles
- Prototype admin `/admin/import` déployé sur staging avec accès protégé par `ADMIN_IMPORT_PASSWORD`
- Flux URL disponible avec écran de revue avant écriture ; flux photo encore non branché
- **Pas encore implémenté** : recherche plein texte, filtres multi-facettes UI, carnet d'idées, liste de courses web, photos, cache offline PWA

### Commandes de développement

```bash
# Installer les dépendances
cd web && npm install

# Lancer le serveur de dev (port 3000)
cd web && npm run dev

# Build de production
cd web && npm run build

# Linter
cd web && npm run lint
```

### Règles de workflow git

- Push par défaut → branche `staging` (jamais `main` sans validation explicite)
- Une seule session agent active à la fois sur ce repo
- Format de commit conseillé : `SXXX — Description courte`
