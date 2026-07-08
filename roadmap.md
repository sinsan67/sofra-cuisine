# Roadmap — Sofra Cuisine

## Maintenant (sprint en cours)

- [x] Schéma SQLite stabilisé (country_code, rating, made_count, recipe_steps avec source)
- [x] 6 recettes originales + étapes (original/suggested) en base
- [x] 4 recettes fitness en base (ingrédients à compléter)
- [x] 5 cocktails au mastic en base (complets)
- [x] Cadrer puis prototyper une page admin d'import de recettes (URL + photo) protégée par mot de passe léger côté serveur
- [ ] Valider le flux réel après login sur staging : login et affichage du brouillon OK, enregistrement réel en base restant à confirmer
- [ ] Ingrédients des 4 recettes fitness à compléter (quand Sinan retrouve ses notes)
- [ ] Trancher le concept `cuisine_type` (nationalité vs famille culinaire)
- [ ] Traiter le PDF Ottolenghi (_ressources input/)
- [ ] Vérifier la compaction des ingrédients sur mobile réel et décider s'il faut un niveau 2 (accordéons, repli par catégorie, ou densification supplémentaire)

## Prochain sprint (avant bootstrap web)

- [ ] Script `generate_obsidian.py` — générer des notes .md par recette dans obsidian/
- [ ] Valider les étapes `suggested` recette par recette avec Sinan
- [ ] Enrichir les recettes kiyma (id=2-6) avec les vraies épices de maman

## Web — fonctionnalités (stack : Next.js + Neon + Vercel)

### Affichage recettes
- [x] Liste des recettes + filtres de collection
- [x] Page recette individuelle
- [x] Ingrédients groupés par catégorie avec mise en page compacte
- [x] Mise en page ingrédients en 2 colonnes sur desktop
- [ ] Ajouter une vraie barre de recherche utilisateur dans l'interface
- [ ] Valider le rendu mobile de la fiche recette sur appareil réel

### Import admin
- [x] Ajouter une page `/admin/import` protégée par mot de passe simple pour usage privé
- [x] Finaliser la sécurité MVP côté accès : mot de passe Vercel branché sur le bon déploiement + login staging validé en vrai parcours
- [ ] Supporter 2 entrées : URL de recette et upload photo
- [x] Ajouter un écran de revue avant toute écriture en base
- [ ] Valider l'enregistrement réel en base depuis le flux URL
- [ ] Pousser sur `staging` le correctif d'extraction JSON-LD HTML-encodé (`application&#x2F;ld&#x2B;json`) puis revalider une URL réelle
- [ ] Utiliser comme support de test UX les captures bureau du 2026-07-04 12.05.57 et 12.19.20

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
