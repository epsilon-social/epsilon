# Epsilon Changelog

Toutes les modifications notables spécifiques au fork Epsilon sont documentées dans ce fichier.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Unreleased]

## [0.3.9] - 2026-09-10

### Added

- **Pull-to-refresh sur le fil d'accueil (coque)** : Geste natif-like — tirer le haut du fil fait glisser **tout le contenu** (compose + fil) vers le bas en suivant le doigt (rubber-band au-delà du seuil), une roue apparaît dans l'espace qui s'ouvre **entre la barre de recherche et le compose** ; au relâché franc le fil se rafraîchit (`expandHomeTimeline`, posts récents via `since_id`) puis tout revient en ressort et la roue disparaît (relâché doux → retour sans refresh). Composant `EpsilonPullToRefresh`, **scopé in-app + fil d'accueil** ; hors coque, on laisse le pull-to-refresh natif du navigateur. Détails d'implémentation : geste écouté sur `window` (scroll-page de la coque) ; listener `touchmove` **non-passif attaché uniquement pendant un tirage démarré à `scrollY 0`** (zéro impact sur le scroll normal) ; **hystérésis directionnelle** (~6px avant de décider pull vs scroll → ne « vole » pas le toucher, plus de scroll figé après un refresh) ; peinture 1:1 en `requestAnimationFrame` sans re-render React, avec **annulation du repaint en attente au relâché** (sinon un repaint tardif écrasait le ressort → saut/téléport du contenu) ; `will-change` posé uniquement le temps du geste (le fil n'étant pas virtualisé en coque = gros calque) ; fallback `prefers-reduced-motion` (pulsation au lieu de rotation).

### Changed

- **Le fil d'accueil ne se met plus à jour tout seul en coque** : Sous coque, les push « update » du stream temps réel pour le home sont ignorés (`updateTimeline`, garde `EPSILON_IN_APP`) → les nouveaux posts n'arrivent **qu'au pull-to-refresh** (ou reload). Le stream reste connecté : notifications, suppressions et éditions de posts déjà affichés restent intactes ; le web garde le live complet. Balisé `EPSILON`.

## [0.3.8] - 2026-09-10

### Changed

- **Thème forcé en auto dans la coque** : Sous coque (UA `EpsilonMobile/`), `color_scheme` / `page_color_scheme` renvoient toujours `auto` (le chrome natif — navbar, splash — reste aligné sur le thème système). Le compte garde son choix côté web. Le sélecteur clair/sombre est masqué dans les réglages en coque (`in_app_request?`). Modifs core balisées `EPSILON` (`theme_helper.rb`, vue `appearance`).
- **Perf iOS — fil opaque, transitions neutralisées** : En coque, les surfaces du fil passent en opaque et les transitions var-based (`--eps-dur-*`) sont neutralisées, car sur WKWebView le mesh/glass était recomposé à chaque frame de scroll (jank). Le tiroir latéral reste un simple slide (panneau opaque) ; les modales natives et la modale compose s'ouvrent sans animation. Neutre pour le web.
- **Zoom de page bloqué en coque** : `minimum-scale=1` + `viewport-fit=cover`, et annulation des évènements `gesture*` WebKit pour empêcher le pinch-zoom de page (jamais de `maximum-scale`/`user-scalable=no`, conforme Apple). Les images restent zoomables via le viewer média (transform-based). Web non affecté.
- **Sidebar en coque — doublons des onglets natifs masqués** : Les entrées Accueil, Recherche, Explorer/Tendances et Notifications sont masquées sous `.epsilon-in-app` (la tab bar native de la coque les fournit). « Nouveau post » est conservé (il ouvre une modale, ne navigue pas).

### Fixed

- **Scroll iOS — sauts par post & écrans blancs/gels** : Virtualisation JS désactivée en coque (`IntersectionObserverArticle`) — en scroll-page, l'observer sans `rootMargin` remplaçait chaque post sorti du viewport par un placeholder, et iOS n'a pas d'`overflow-anchor` pour compenser (saut à chaque post, blancs sous inertie). Tous les items restent montés en coque ; le web garde la virtualisation. Balisé `EPSILON`.
- **Débordement horizontal de page en coque** : `overflow-x: clip` sur `html.epsilon-in-app` + masquage des chevrons du carrousel de suggestions (positionnés hors cadre) qui laissaient « paner » la page et révéler une bande de fond à droite.
- **Tab bar native restée masquée après les réglages** : Une navigation pleine page vers une page Rails (`/settings/*`) démonte la SPA sans exécuter le cleanup React → l'overlay ne renvoyait jamais son `close` et la tab bar native restait cachée. On rejoue les `close` sur `pagehide` et on les ré-assère sur restauration bfcache (`pageshow` persisted).
- **Service Worker périmé en coque** : Le SW n'est plus enregistré sous coque (WKWebView ne fait pas de Web Push ; le push passe par le relais APNs natif) et les SW + caches `mastodon-*` laissés par un build précédent sont démontés au démarrage. Évite de servir un shell d'app périmé. Balisé `EPSILON` (`main.tsx`).
- **Onglets Explorer** : Retrait du `gap` natif, scopé aux seuls onglets d'Explorer (plus de décalage).
- **Dropdown d'autosuggest (@mention/emoji) sans fond** : Le conteneur utilisait `--color-bg-primary`, remappé transparent par Epsilon → suggestions illisibles. Il reçoit désormais la même surface que les autres dropdowns (opaque en contraste élevé).
- **Notifications mention — icône ⋯ hors cadre** : Le padding du wrapper `.notification-ungrouped--mention` s'ajoutait à la mise en page du statut → l'action ⋯ débordait. Padding retiré, le statut gère l'espace.
- **Topbar en contraste élevé sans fond** : Le scrim de la topbar reposait sur le flou, retiré par le mode contraste élevé → barre sans fond. En HC (OS + toggle in-app), la topbar reçoit un aplat opaque (base claire `#f4f7fa` / stone sombre `#1f1e1e`) + un filet net ; scrim masqué.
- **Barre « non lu » coupée en mobile** : L'indicateur `border-inline-start` (mentions/conversations non lues) se retrouvait collé/coupé sur mobile ; masqué sous 768px.

### Removed

- **Halos de marque (glows)** : Retrait de tous les `drop-shadow`/`box-shadow` en `--eps-brand-glow` (logo topbar, logo sidebar, halos de survol des boutons) et suppression du token `--eps-brand-glow` (clair + sombre), devenu sans usage.

## [0.3.7] - 2026-09-01

### Added

- **Détection du contexte in-app (coque mobile)** : Ajout d'une classe `epsilon-in-app` sur `<html>` lorsque la page est servie dans la WebView Expo, détectée via le préfixe stable `EpsilonMobile/` de l'User-Agent. Script inline exécuté avant le premier rendu (pas de flash), passé par `javascript_inline_tag` (empreinte CSP). Neutre pour le web (l'UA ne matche pas). Aucun couplage à la coque au-delà de l'UA.
- **Pont d'overlays natif** : Nouveau canal `postMessage` entre le web et la coque. Web → natif : émission de `epsilon:web-overlay { visible, source }` chaque fois qu'un overlay s'ouvre/se ferme, la coque agrégeant les sources indépendamment (jamais de compteur global). L'observation de la pile de modales est **générique** (aucune liste en dur) — tout nouveau modalType retombe sur un `source` kebab-case, donc aucun overlay ne peut être silencieusement manqué. Sources nommées : `navigation`, `compose`, `logout`, `report`, `block`, `mute`, `filter`, `domain-block`, `media-viewer`, `post-actions`, `profile-actions`. Les menus ⋯ de post et de profil (même modalType `ACTIONS`) sont distingués via une prop `overlaySource`. Natif → web : `epsilon:open-menu` ouvre le tiroir latéral en réutilisant l'action `openNavigation` existante. Listener durci (string seule, `JSON.parse` protégé, filtre `epsilon:`). Strictement no-op hors WebView (`window.ReactNativeWebView` feature-detecté).
- **Lien « Rechercher » dans la barre latérale** : Ajout d'un accès direct à la recherche (`/search`) dans la sidebar gauche, pour les utilisateurs connectés.

### Changed

- **Masquage de la barre de navigation web du bas en coque** : Sous `.epsilon-in-app`, la barre flottante du bas est masquée (la tab bar native de la coque la remplace) et le dégagement bas du layout retombe sur la marge de confort (`max(16px, safe-area-inset-bottom)`). Neutre pour le web.
- **Écran de connexion — safe-areas et anti-zoom iOS** : Paddings de la page d'auth ancrés sur `env(safe-area-inset-*)` (plein écran propre en coque, neutre sur web/desktop/PWA où `env()` vaut 0). Champs de formulaire portés à 16px sur mobile pour empêcher le zoom automatique d'iOS au focus, sans désactiver le zoom global (pas de régression d'accessibilité).
- **Champ de recherche à 16px** : Taille de police du champ de recherche remontée de 15px à 16px (même motif anti-zoom iOS).

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
