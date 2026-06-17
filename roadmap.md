# Roadmap — Sofra Cuisine

## Maintenant (sprint en cours)

- [x] Schéma SQLite stabilisé (country_code, rating, made_count, recipe_steps avec source)
- [x] 6 recettes originales + étapes (original/suggested) en base
- [x] 4 recettes fitness en base (ingrédients à compléter)
- [x] 5 cocktails au mastic en base (complets)
- [ ] Ingrédients des 4 recettes fitness à compléter (quand Sinan retrouve ses notes)
- [ ] Trancher le concept `cuisine_type` (nationalité vs famille culinaire)
- [ ] Traiter le PDF Ottolenghi (_ressources input/)

## Prochain sprint (avant bootstrap web)

- [ ] Script `generate_obsidian.py` — générer des notes .md par recette dans obsidian/
- [ ] Valider les étapes `suggested` recette par recette avec Sinan
- [ ] Enrichir les recettes kiyma (id=2-6) avec les vraies épices de maman

## Web — fonctionnalités (stack : Next.js + Neon + Vercel)

### Affichage recettes
- [ ] Liste des recettes + barre de recherche
- [ ] Page recette individuelle

### Affichage original / enrichi ⭐ (idée clé S003)
- [ ] Afficher la recette originale par défaut (étapes `source='original'`)
- [ ] Bouton "Version enrichie" → superpose les étapes `source='suggested'` en couleur distincte
- [ ] Code couleur : gris = original · bleu/vert = suggestion Claude
- [ ] Option : afficher les suggestions inline (couleur) ou en colonne parallèle

### Idées / projets à maturer (idée S003)
- [ ] Section dédiée aux idées de cuisine en cours de réflexion (pas encore des recettes)
- [ ] Format léger : titre + texte libre + date + statut (idée / en test / intégré)

## Vision long terme

- Skills par famille culinaire pour enrichissement ciblé
  - `skill-cuisine-turque` → connaît les kiyma, les épices turques, les techniques de maman
  - `skill-cuisine-française` → connaît les quiches, les sauces, la tradition française
  - `skill-fitness` → connaît les substitutions macro, les ratios protéines
  - `skill-cocktail` → connaît la mixologie, les associations d'arômes
- Chaque skill produit des suggestions calibrées par contexte culturel
- Génération de liste de courses depuis un plan de repas hebdomadaire (script déjà en place)
- Auth (si besoin de rendre le site privé ou multi-utilisateur)
