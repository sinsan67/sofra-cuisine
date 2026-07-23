# Roadmap — Sofra Cuisine

## Maintenant (sprint en cours)

- [x] Schéma SQLite stabilisé (country_code, rating, made_count, recipe_steps avec source)
- [x] 6 recettes originales + étapes (original/suggested) en base
- [x] 4 recettes fitness en base (ingrédients à compléter)
- [x] 5 cocktails au mastic en base (complets)
- [x] Formaliser en SQL la V1 du socle documentaire mutualisé (`document_sources`, `recipe_documents`, provenance, structures recette, publications, vues de compatibilité)
- [x] Cadrer puis prototyper une page admin d'import de recettes (URL + photo) protégée par mot de passe léger côté serveur
- [x] Valider le flux réel URL sur staging : login OK, brouillon Marmiton OK, enregistrement réel OK, recette publique `#31` visible
- [x] Débloquer le déploiement Vercel staging du commit `bd3da68` puis redéployer staging avec succès (`eb5071d`)
- [x] Auditer le schéma réellement actif derrière `sofra-cuisine-3` avant toute exécution de la migration documentaire V1
- [x] Écrire le script de backfill depuis les tables historiques `recipes*` vers `recipe_documents` et `recipe_structures`
- [x] Définir puis brancher la couche de compatibilité lecture côté web à partir des vues `recipe_document_*_compat_v1`
- [x] Exécuter la migration V1 sur la base Neon cible après audit du schéma live et validation humaine
- [x] Exécuter le backfill documentaire V1 sur Neon (`recipes = 30`, `recipe_documents = 30`, `recipe_structures = 30`, `ingredient_items = 227`, `instructions = 132`, contrôlé le 2026-07-22)
- [x] Vérifier post-backfill que `recipe_documents >= recipes` puis revalider le front staging sur les vues de compatibilité (`/fr/recettes` = `30 résultats`, fiche `#1 Quiche à la tomate` OK le 2026-07-22)
- [x] Rédiger le fichier de transmission pour l'agent d'import afin qu'il écrive directement les recettes envoyées par Sinan dans le format documentaire cible
- [ ] Retrouver / vérifier la vraie valeur Preview de `ADMIN_IMPORT_PASSWORD` sur Vercel pour pouvoir tester le flux photo réel
- [ ] Ingrédients des 4 recettes fitness à compléter (quand Sinan retrouve ses notes)
- [ ] Trancher le concept `cuisine_type` (nationalité vs famille culinaire)
- [ ] Traiter le PDF Ottolenghi (_ressources input/)
- [ ] Vérifier la compaction des ingrédients sur mobile réel et décider s'il faut un niveau 2 (accordéons, repli par catégorie, ou densification supplémentaire)

## Prochain sprint (avant bootstrap web)

- [ ] Faire porter au nouvel import photo / PDF les recettes dans `recipe_documents` au lieu d’écrire directement dans `recipes`
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
- [x] Supporter 2 entrées : URL de recette et upload photo
- [x] Ajouter un écran de revue avant toute écriture en base
- [x] Valider l'enregistrement réel en base depuis le flux URL
- [x] Pousser sur `staging` le correctif d'extraction JSON-LD HTML-encodé (`application&#x2F;ld&#x2B;json`) puis revalider une URL réelle
- [ ] Valider sur staging le nouveau flux photo : upload image -> brouillon manuel -> enregistrement en base
- [ ] Comprendre pourquoi `sinan` ne crée pas de session admin sur le staging Preview alors que la route est bien active
- [ ] Décider si le MVP photo sans OCR peut passer en prod, ou s'il faut brancher une vraie extraction avant merge
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
