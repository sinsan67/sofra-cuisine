# Handoff agent — import documentaire V1

Date de référence : 2026-07-22
Projet : Sofra Cuisine
Base cible : Neon partagée derrière `sofra-cuisine-3`

## But

Le prochain agent d'import ne doit plus considérer `recipes`, `recipe_ingredients` et `recipe_steps` comme la structure canonique d'une nouvelle recette.

La recette canonique doit être écrite dans le modèle documentaire V1 :

- `document_sources`
- `source_assets`
- `recipe_documents`
- `recipe_document_translations`
- `recipe_structures`
- `recipe_ingredient_groups_v1`
- `recipe_ingredient_items_v1`
- `recipe_instructions_v1`
- `document_blocks`
- `document_publications`

## État live confirmé

Le backfill V1 a été exécuté le 2026-07-22 sur Neon.

- `recipes = 30`
- `recipe_documents = 30`
- `recipe_structures = 30`
- `recipe_ingredient_groups_v1 = 30`
- `recipe_ingredient_items_v1 = 227`
- `recipe_instructions_v1 = 132`
- `document_blocks = 384`
- `document_publications = 30`
- `legacy_links_missing = 0`
- `documents_without_structure = 0`

Le front staging bascule vers les vues `recipe_document_*_compat_v1` dès que `recipe_documents >= recipes`.

## Règle de transition à respecter

Même si la source de vérité devient documentaire, le front conserve encore une dépendance transitoire à `recipe_tags` via `recipe_documents.legacy_recipe_id`.

Conséquence :

1. Pour chaque nouvelle recette importée, créer d'abord une ligne `recipes` minimale pour obtenir un `legacy_recipe_id`.
2. Réutiliser cet identifiant comme `recipe_documents.id` et comme `recipe_documents.legacy_recipe_id`.
3. Écrire les facettes transitoires dans `recipe_tags` tant que la lecture web n'a pas encore migré hors de cette table.
4. Considérer malgré tout `recipe_documents` et les tables V1 comme la source canonique du contenu.

Cette double écriture est transitoire. Elle existe seulement pour garder des routes stables et ne pas casser les facettes du front actuel.

## Ordre d'écriture recommandé

### 1. Source fidèle

Créer `document_sources` avec :

- `source_kind` : `photo`, `pdf`, `website`, `scan_batch` ou valeur cohérente équivalente
- `title`
- `author`
- `language_code`
- `source_url`
- `source_file`
- `notes`
- `metadata`

Créer ensuite `source_assets` pour l'actif principal :

- `asset_kind` : `photo`, `pdf`, `web_capture`, `other`
- `storage_path`
- `original_filename`
- `is_primary = true`

Si l'import vient d'une photo ou d'un PDF, conserver le chemin fichier ou l'URL de stockage dans `storage_path`.

### 2. Pont legacy minimal

Créer une ligne `recipes` minimale pour porter l'ID historique :

- `name`
- `source_url`
- `source_file`
- `author`
- `notes`
- `cuisine_type`
- `dish_type`
- `servings`
- `prep_time`
- `cook_time`
- `country_code`

Ne pas enrichir cette table au-delà du minimum utile au pont. La donnée canonique reste documentaire.

### 3. Document canonique

Créer `recipe_documents` avec :

- `id = legacy_recipe_id`
- `legacy_recipe_id = legacy_recipe_id`
- `source_id`
- `document_kind = 'recipe'`
- `workflow_status = 'draft'`
- `canonical_locale`
- `title`
- `subtitle` si disponible
- `summary` si disponible
- `intro` si disponible
- `notes`
- `author`
- `country_code`
- `rating` si connu
- `made_count = 0` par défaut
- `last_made = NULL` par défaut
- `metadata`

Le `metadata` doit au minimum garder la trace :

- de l'agent ou script producteur
- du canal d'import (`photo`, `pdf`, `url`, `manuel`)
- de l'identifiant source externe si disponible
- de toute information brute qu'on ne sait pas encore normaliser

### 4. Traductions document

Créer `recipe_document_translations` uniquement pour les locales réellement disponibles.

- Pour une recette FR seule, ne pas inventer de traduction.
- Si une traduction existe, renseigner `title` et `notes`, puis `subtitle`, `summary`, `intro` quand ces champs sont réellement connus.

### 5. Structure normalisée

Créer `recipe_structures` :

- `document_id`
- `cuisine_type`
- `dish_type`
- `servings_value`
- `servings_text`
- `prep_time_minutes`
- `cook_time_minutes`
- `total_time_minutes`
- `difficulty` si connue
- `yield_text` si utile
- `metadata`

### 6. Ingrédients

Créer au moins un groupe dans `recipe_ingredient_groups_v1`.

Règle minimale :

- un seul groupe si la source ne distingue pas de sous-sections
- `group_order = 1`
- `title = NULL` si aucun titre éditorial n'est certain
- `raw_title = 'ingredients'` si on n'a pas mieux

Créer ensuite les lignes `recipe_ingredient_items_v1` dans l'ordre de la source.

Champs à privilégier :

- `ingredient_group_id`
- `ingredient_order`
- `ingredient_id` si l'ingrédient a pu être relié proprement au référentiel
- `raw_text` obligatoire
- `ingredient_text`
- `quantity_value`
- `quantity_text`
- `unit_text`
- `preparation_text`
- `note_text`
- `is_optional`
- `metadata`

Règle importante :

- ne jamais perdre la ligne brute d'origine
- `raw_text` reste obligatoire même si la normalisation est incomplète

### 7. Étapes

Créer `recipe_instructions_v1` dans l'ordre source.

- `step_number`
- `title` si la source contient un vrai intertitre
- `raw_text` obligatoire
- `instruction_text`
- `source_kind = 'original'` pour le texte fidèle

Utiliser `source_kind = 'suggested'` seulement pour un enrichissement ultérieur clairement séparé.

### 8. Blocs éditoriaux

Créer `document_blocks` pour refléter le contenu visible côté publication.

Minimum attendu :

- un bloc `note` si la recette contient une note utile
- des blocs `ingredient_item`
- des blocs `instruction`

Champs :

- `document_id`
- `locale`
- `block_order`
- `block_type`
- `source_mode`
- `body_text`
- `data_json`

Règle :

- réserver des `block_order` stables et déterministes
- distinguer le brut, le normalisé et le publié via `source_mode`

### 9. Publication

Créer `document_publications` :

- `document_id`
- `app_key = 'sofra-cuisine'`
- `publication_status = 'draft'`
- `locale = canonical_locale`
- `is_primary = true`

Ne publier en `published` qu'après une vraie décision éditoriale.

## Champs source à préserver absolument

- nom ou titre original
- URL source si elle existe
- nom de fichier source si la recette vient d'une photo ou d'un PDF
- auteur ou provenance éditoriale
- langue originale
- note ou commentaire fidèle
- texte brut de chaque ingrédient
- texte brut de chaque étape

## Ce qu'il ne faut pas faire

- Ne pas écrire seulement dans `recipes` en espérant backfiller plus tard.
- Ne pas jeter le texte brut une fois l'ingrédient ou l'étape normalisé.
- Ne pas inventer de traduction.
- Ne pas créer de `source_kind = suggested` pour une étape source fidèle.
- Ne pas casser l'alignement d'ID : pendant la transition, `recipe_documents.id` doit rester aligné sur `legacy_recipe_id`.

## Contrôle final attendu après import

Pour chaque nouvelle recette :

1. `recipe_documents.id = recipe_documents.legacy_recipe_id`
2. une ligne `recipe_structures` existe
3. au moins un groupe d'ingrédients existe
4. au moins un item ingrédient existe
5. au moins une instruction existe
6. une ligne `document_publications` existe pour `app_key = 'sofra-cuisine'`
7. si des facettes sont connues, elles existent aussi dans `recipe_tags`

## Conséquence pour le code existant

Le fichier actuel [web/src/lib/admin-recipes.ts](/Users/sinsan/Projets/cuisine/web/src/lib/admin-recipes.ts) écrit encore uniquement dans les tables legacy.

Le prochain chantier d'implémentation consiste donc à remplacer cette écriture par :

- une écriture canonique dans le modèle documentaire V1
- un pont legacy minimal pour `legacy_recipe_id`
- l'alimentation transitoire de `recipe_tags`
