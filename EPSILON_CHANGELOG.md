# Epsilon Changelog

Toutes les modifications notables spécifiques au fork Epsilon sont documentées dans ce fichier.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Unreleased]

## [0.3.6] - 2026-08-26

### Changed

- **Rebranding des emails transactionnels** : Refonte de l'habillage de tous les mails à l'identité Epsilon. Header sombre aplati (`#16171a`, sans mesh PNG), palette remappée sur les tokens `$eps-*` (accent/liens/boutons en bleu de marque `#4571ff`, hover `#3b60d9` — aligné sur le token web `--eps-brand-primary`, cf. 0.3.3), logos header/footer Epsilon (wordmark + icône), footer nettoyé (retrait de « Mastodon hosted on … » et du hostname sous le logo), titre du document piloté par l'instance, icônes « heading » brand-neutres recolorées en bleu (couleurs sémantiques succès/danger/login conservées). Textes du mail de bienvenue dé-mastodonisés (fr + en) : nom produit → « Epsilon », « serveur Mastodon » (réseau) → « fédiverse » ; objet « Bienvenue sur Epsilon » / « Welcome to Epsilon ». Modifs core balisées `EPSILON` (HAML + SCSS). Suppression des assets morts `header-bg-{start,end}.png`.

### Removed

- Assets emails inutilisés `mailer-new/common/header-bg-start.png` et `header-bg-end.png` (header désormais aplati).

## [0.3.5] - 2026-08-26

### Added

- **Pont de session (application native)** : Nouvel échange permettant à la coque mobile (WebView) d'ouvrir une session web à partir de son jeton OAuth, sans redemander les identifiants au démarrage à froid. Flux en deux temps — émission (`POST /api/v1/epsilon/session_bridge`, authentifiée par Bearer) puis consommation (`GET /auth/bridge`) — où le jeton d'échange à usage unique transite par Redis (haché, TTL 30 s, consommé de façon atomique) et n'apparaît jamais dans une URL journalisée. La session ouverte est strictement équivalente à une connexion normale (mêmes `SessionActivation`, cookie de session et portée du jeton web).

### Security

- **Pont de session — garde-fous** : Réservé à l'application first-party Epsilon (`EPSILON_FIRST_PARTY_CLIENT_ID`, fail-closed) ; refusé aux comptes staff / privilégiés (deny-by-default) et aux comptes non fonctionnels ; ré-vérification de l'état du compte et du jeton au moment de la consommation ; `reset_session` à l'ouverture (anti-fixation) ; limitation de débit (10 émissions / 5 min / compte, 60 consommations / 5 min / IP) ; isolation entre instances (domaine local inclus dans la clé Redis) ; journalisation dans `LoginActivity` (méthode `session_bridge`). Couverture de tests complète : services d'émission / consommation, endpoints, équivalence avec un login normal, anti-fixation et throttles.

## [0.3.4] - 2026-08-26

### Added

- **Safe-areas iOS (coque mobile)** : Compensation des zones système de l'iPhone (encoche / Dynamic Island / indicateur home) via `env(safe-area-inset-*)` sur les surfaces `fixed`/`sticky` — barre supérieure et son dégradé, barre de navigation inférieure, paddings du layout, tiroir latéral gauche, modale de composition. Neutre hors coque (Safari, desktop, PWA → `env()` vaut 0) ; s'active uniquement quand la WebView est en plein écran (edge-to-edge).

## [0.3.3] - 2026-08-24

### Added

- **Page « À propos » repensée** : Remplacement de la fiche d'instance Mastodon générique par une véritable page de marque (manifeste). Positionnement de réseau social européen et souverain, six piliers de valeurs présentés en cartes (Européen & souverain, Modération à visage humain, Sans manipulation, Vie privée respectée, Ouvert & interopérable, Par thèmes plutôt qu'addiction), section « Notre engagement », mentions légales conservées et accessibles. Textes en français et anglais (i18n).
- **Logo dans la barre latérale** : Wordmark Epsilon affiché dans la barre latérale gauche.

### Changed

- **Système de design (tokens)** :
  - Bleu de marque affiné vers un ton plus profond et saturé (`#5d95ff` → `#4571ff`), avec un token de halo (`--eps-brand-glow`).
  - Arrondis resserrés : rayon principal `35px` → `24px` (rendu moins « bulle »), et nouvelle échelle cohérente `--eps-radius-sm/md/lg` (12 / 16 / 24 px) — 24 px pour les cartes, 16 px pour les menus et dialogues, 12 px pour les petits éléments.
  - Échelle de durées d'animation (`--eps-dur-fast/base/slow`) pour des transitions homogènes.
  - Tokens de bordure de carte par thème (transparente en clair, `#262626` en sombre).
- **Barre supérieure** : Supprimée au format desktop (conservée uniquement en mobile, ≤ 768 px) ; le logo passe dans la barre latérale gauche.
- **Pages de profil** : L'ensemble du profil (fil, médias, en vedette, abonnés / abonnements, édition) est regroupé dans une grande carte. Bannière détachée des bords en « carte dans la carte » avec coins concentriques, avatar réaligné, publications aplaties en lignes bordées ; lignes d'abonnés / abonnements présentées en cartes individuelles. Bouton « Retour » sans encadré.
- **Alignement des colonnes** : Hauts de la barre latérale gauche, de la colonne centrale et du panneau de droite alignés.
- **Modales** : Les modales natives (édition de profil, confirmations, import d'image) adoptent le rendu « verre » de la modale de composition — fond d'écran flouté, surface claire — en supprimant le filtre d'assombrissement natif ; arrondis harmonisés.
- **Boutons de menus / dropdowns** : Les popovers en modules CSS (filtre de profil, autocomplétion, aide du @handle) reprennent le style du dropdown de référence (surface verre, arrondi, ombre) ; boutons uniformisés (pilules, animation d'appui sur tous les boutons).
- **État sélectionné au survol (desktop)** : Les éléments sélectionnés restent visiblement sélectionnés au survol (changement de fond, pas seulement de couleur de texte).
- **Espacement & finitions** : Meilleurs espacements sur la composition (desktop, mobile, format moyen), densité et cibles tactiles portées à ≥ 44 px, polissage général des survols.
- **Carte de suggestions de catégories** : Bordure complète en thème sombre (`#262626`), suppression du liseré en haut, couleurs de carte de marque mises à jour.

### Fixed

- **Modification d'un statut** : Le bouton « Modifier » du menu d'un statut ouvre désormais la modale de composition.
- **Onglets de profil** : Le survol des onglets (Activité / Médias / En vedette) rendait le texte invisible (`--color-text-brand-soft` remappé en transparent) — restauré sur le bleu de marque, ce qui répare aussi une douzaine d'autres états de survol.
- **Erreurs de formulaire (inscription / connexion)** : Les erreurs de validation (nom d'utilisateur déjà pris, etc.) s'affichent désormais dans la nouvelle interface ; le bouton de connexion ne repasse plus au violet Mastodon d'avant la refonte lors d'un appui maintenu.
- **Survol tactile (iOS)** : La sélection d'une catégorie (`/start/categories`) s'affiche immédiatement au tap (survols tactiles collants neutralisés via `@media (hover: hover)`).
- **Modale d'import d'image** : Fond transparent en thème clair corrigé (surface verre).
- **Indicateur d'édition** : L'encart natif « vous modifiez ce message » dans la modale de composition est restylé.

## [0.3.2] - 2026-08-21

### Security

- **Correctifs de sécurité hérités** (upstream Mastodon 4.6.1→4.6.6) : renforcement de la protection SSRF (contournement via adresses IPv6 mappées IPv4), correction d'une application incorrecte des permissions, et mise à jour de FFmpeg dans l'image conteneur (CVE-2026-8461, critique).

### Maintenance

- **Upstream Merge** : Mise à jour de la base de code de Mastodon `v4.6.0` vers `v4.6.6` (aucune migration de base de données).

## [0.3.1] - 2026-07-30

### Changed

- **Pages Explorer / Tendances** : Publications, Comptes, Hashtags et Actualité présentés en cartes — une grande carte conteneur englobant une carte par élément, dans la continuité de la page Notifications.
- **Densité des notifications** : Espacement unifié (haut = entre les éléments = côtés) sur les pages Notifications (Tout et Mentions) et les mentions privées ; réduction de l'imbrication « boîte dans une boîte » sur les mentions et réponses.
- **Demandes de suivi** : Le bandeau d'explication des demandes de suivi est intégré à la carte des notifications (sans encadré ni fond dédié).

### Fixed

- **Modale de composition** : Les boutons « Mentionner @utilisateur » et « Mentionner en privé » du menu d'un statut ouvrent désormais la modale de composition (ils restaient sans effet auparavant).
- **Bordure des cartes** : Affichage du contour de la grande carte sur les pages Notifications, aligné sur les pages Tendances.

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
