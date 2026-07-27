# Epsilon Changelog

Toutes les modifications notables spécifiques au fork Epsilon sont documentées dans ce fichier.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Unreleased]

## [0.3.0] - 2026-07-27

### Added

- **Refonte complète de l'interface** : Nouveau layout Epsilon en trois colonnes (barre latérale de navigation, colonne centrale, panneau de droite), avec barre de navigation supérieure et navigation mobile dédiée (menu hamburger, barre d'onglets mobile).
- **Thème clair / sombre** : Système de design tokens `--eps-*` unifié pour les deux thèmes, avec fond en dégradé dédié au mode clair.
- **Composition de publication** : Nouvelle modale de composition (bouton « Nouveau post » sur desktop et mobile), formulaire de réponse en ligne sous les statuts détaillés, et ouverture automatique de la modale sur réponse/citation.
- **Panneau de droite** : Widgets de suggestions de comptes à suivre et de catégories, avec liens vers `/explore/suggestions`.
- **Sidebar hors connexion** : Affichage de la barre latérale pour les visiteurs non authentifiés, avec animations d'erreur.
- **Favoris** : Passage de l'icône étoile à l'icône cœur.
- **Administration** : Le fil « Live feed » peut être masqué par un administrateur ; ajout du lien « Demandes de suivi » dans la barre latérale.

### Changed

- **Restyle des pages** : Pages d'authentification, notifications, `/start/categories`, statut détaillé et section Explorer ré-habillées selon la nouvelle charte.
- **Suggestions de catégories** : Bloc de suggestions dans le panneau de droite, avec mémorisation locale (localStorage) d'un rejet valable 30 jours ; rechargement du fil d'accueil à la validation des abonnements.
- **En-têtes de colonnes** : Ajout d'un en-tête cohérent sur toutes les pages ; barre de navigation supérieure masquée au défilement.

### Fixed

- **Restauration du défilement** : Retour à la position précédente lors de la navigation arrière (back) depuis un statut détaillé.
- **Modale de composition** : Ne s'ouvre plus par erreur au clic sur une publication qui n'est pas une réponse ; plus de saut en haut de page lors d'une réponse ou d'une citation.
- **Pages non authentifiées** : Correction des erreurs 401/422 sur la page « À propos » et de l'affichage des boutons de la barre latérale.
- **Flou (backdrop-filter)** : Correction du flou de la barre supérieure (préfixe `-webkit-` écrit avant la version non préfixée, requis en build de production).
- **Espacements mobiles** : Padding cohérent pour le menu hamburger, la barre de recherche, les en-têtes de colonnes et le bas du panneau de droite.
- **Onboarding** : Barre d'étapes passée de 3 à 4 étapes et correction de son style.

### Maintenance

- **Upstream Merge** : Mise à jour de la base de code vers Mastodon `v4.6.0`.

## [0.2.2] - 2026-07-20

### Changed

- **Navigation** : Interversion des onglets Hashtags et Listes dans le panneau de navigation (ordre : Catégories, Hashtags, Listes).

## [0.2.1] - 2026-07-20

### Maintenance

- **Tests** : Ajout d'une couverture de tests complète pour le système de catégorisation — specs RSpec des modèles, workers (moteur de catégorisation, backfill et nettoyage du fil), endpoints API et pages d'administration ; test unitaire front (Vitest) pour la localisation des noms de catégories.

## [0.2.0] - 2026-07-20

### Added

- **Système de catégorisation de contenu** : Introduction d'un système complet d'organisation et de personnalisation du contenu par thématiques (catégories).
  - **Catégorisation automatique des publications** : Chaque publication locale est rattachée à une ou plusieurs catégories selon ses hashtags, son contenu et son auteur.
  - **Abonnements aux catégories** : Les utilisateurs s'abonnent aux thématiques de leur choix pour façonner leur fil d'accueil ; l'abonnement et le désabonnement mettent le fil à jour en arrière-plan.
  - **Onboarding par centres d'intérêt** : Nouvelle étape de sélection des catégories à l'inscription, placée avant la suggestion de comptes à suivre.
  - **Réglages utilisateur** (`/categories`) : Page dédiée pour gérer ses abonnements aux catégories, avec recherche.
  - **Suggestions de catégories** : Bloc de suggestions de thématiques à suivre sur le fil d'accueil.
  - **Administration des catégories** (`/admin/epsilon/categories`) : Création, renommage et suppression de catégories ; gestion des hashtags associés (ajout en masse, migration, copie et retrait par sélection multiple) ; recherche de hashtags par similarité ; assignation de catégories directement depuis la liste des hashtags (`/admin/tags`).
  - **Traductions gérées en base** : Noms de catégories multilingues (FR/EN) éditables depuis l'administration, sans modification du code.
  - **Taxonomie & données** : 23 catégories officielles fournies avec leur base de correspondances hashtag → catégorie, et tâches de seed/reshape idempotentes et non-destructives.

## [0.1.0] - 2026-06-05

### Added

- **AI Moderation** : Intégration du système complet de modération automatisée par IA pour les statuts.
- **Fail Open Moderation / Kill Switch** : Ajout d'un bouton de désactivation d'urgence dans le dashboard administrateur en cas de panne de l'IA (#6, #7).
- **Onboarding** : Ajout d'un widget de suggestion de profils sur les pages vides pour guider les nouveaux utilisateurs (#2).

### Changed

- **Post Modification & Content Limits** : Augmentation de la limite de caractères des statuts (passant de 1000 à 9000) et de la limite de médias par post (passant de 4 à 10) (#4, #10).
- **[Beta Only] Navigation** : Redirection automatique des utilisateurs non authentifiés de la page d'accueil ("Home") vers la page de présentation ("About") (#9).
- **UI/Branding** : Suppression de la mention et du logo natif "Powered by Mastodon".
- **Explore Page** : Réorganisation structurelle de l'ordre d'affichage des sous-pages dans la section Explorer (Personnes, Hashtags, Actualités, Messages) (#2).

### Fixed

- **Boost Resilience** : Correction de l'erreur d'injection sur l'action de Boost, permettant de laisser passer les partages sans déclencher le workflow de modération par IA (#8).
- **Pending Posts** : Correction de l'erreur d'affichage générant de fausses citations "Post pending" pendant le traitement asynchrone de l'IA.

### Maintenance

- **Upstream Merge** : Alignement et mise à jour de la base de code avec le tag natif Mastodon `v4.5.8`.

## [0.0.1] - 2026-02-27

### Added

- **Branding Framework** : Initialisation de la charte graphique et des éléments de l'identité visuelle Epsilon. Injection du logo principal et recalibrage des dimensions d'affichage (#1).

### Changed

- **Responsive Branding** : Intégration et adaptation responsive du logo Epsilon spécifiquement dédié aux viewports mobiles.
- **UI/Branding** : Remplacement des assets visuels natifs de Mastodon par les déclinaisons graphiques d'Epsilon.

### Fixed

- **Dynamic Assets** : Correction de la gestion des styles du logo pour assurer le support dynamique des thèmes (Light / Dark mode).
