# Epsilon Changelog

Toutes les modifications notables spécifiques au fork Epsilon sont documentées dans ce fichier.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Unreleased]

## [0.3.11] - 2026-09-17

### Added

- **Comptes certifiés — badges assignables (système sidecar, non-destructif)** : Nouveau système de badges de certification attribuables aux comptes locaux (ambassadeurs, équipe, comptes aimés, etc.), **indépendant des rôles natifs** — inadaptés ici : un seul rôle par compte, porteurs de permissions, et affichés uniquement sur le profil. Trois tables sidecar : **`epsilon_badges`** (définition d'un badge : `slug`, `name`/`description` **traduits** `jsonb` EN/FR façon `category_masters`, `color` hex, `icon`, `position`, `is_active`, counter cache), **`epsilon_account_badges`** (jointure **many-to-many** compte↔badge, index unique) et **`epsilon_badge_pending_grants`** (onboarding, cf. plus bas). Modèles `Epsilon::Badge` / `Epsilon::AccountBadge` / `Epsilon::BadgePendingGrant`, concern `Epsilon::AccountBadgeExtension` (`account.epsilon_badges`, actifs + triés par priorité). **Dashboard admin** `/admin/epsilon/badges` (policy `Epsilon::BadgePolicy`, `manage_users`) : CRUD complet (nom/description **bilingues**, **color-picker**, priorité, actif/inactif), **picker d'icônes visuel** (39 icônes curées en grille + `<details>` « Voir plus » débloquant les **321 Material Symbols** du dossier partagé, sélection live via `:has(:checked)`, sans JS), **attribution par pseudo** (nom d'utilisateur local ou e-mail), **import CSV** en masse, liste des porteurs (retrait individuel) et des grants en attente. Attribution/retrait **aussi depuis la page de modération d'un compte** (`/admin/accounts/:id`, section balisée `EPSILON` rendue via partial sidecar, contrôleur `Admin::Epsilon::AccountBadgesController`). Chaque attribution porte une **date d'obtention** (`granted_at` sur `epsilon_account_badges`) — à l'attribution directe = le moment de l'attribution ; via un grant en attente (CSV/e-mail) = **le moment où la personne crée son compte** (à la confirmation), pas la date d'import ; colonne back-datable au besoin. Sert à jauger l'ancienneté/rareté d'un badge, et est **affichée dans l'admin et dans le tooltip du badge** côté public (« Obtenu le … », date localisée). Pour la porter sans N+1, le serializer itère la **jointure** `account_badges` (le preload est `account_badges: :badge`, pas la simple association). **Exposition** : `Epsilon::AccountSerializerExtension` ajoute `epsilon_badges` au compte REST, **comptes locaux uniquement** et **jamais fédéré** (attribut REST, hors payload ActivityPub → les autres instances ne le reçoivent pas), nom/description **servis dans la langue du lecteur** (`I18n.locale`, fallback EN). **Rendu (front)** : composant unique `EpsilonBadges` monté sur le **header de profil** (badges en flux inline formant **une carte arrondie par ligne** via `box-decoration-break`, débutant après le pseudo) et en **overlay épinglé au coin bas-droit de l'avatar** sur chaque **post** et dans la **sidebar gauche** (un seul badge, le prioritaire, pour ne pas surcharger). N'importe quelle icône choisie est **teintée à la couleur du badge** via un **masque CSS** (`background-color: currentColor` + `mask-image`, résolution slug→URL par `import.meta.glob` — que des URLs, bundle léger). **Tooltip custom** au survol (remplace le `title` natif non stylable) rendu en **portail** (`react-overlays`, `strategy: fixed` → échappe au `overflow: hidden` des posts), avec **délai anti-flash** et **neutralisation de la hover card de profil** quand le curseur est sur un badge (plus de deux cartes superposées, via `hover_card_controller.tsx`). **Onboarding des préinscrits** : `epsilon_badge_pending_grants` (e-mail → badge) met un badge « en attente » pour un e-mail sans compte ; à la **confirmation d'e-mail** (`Epsilon::UserBadgeExtension`, `after_commit` sur `confirmed_at`), le service `Epsilon::ApplyPendingBadgeGrantsService` attribue le badge **automatiquement** et consomme le grant — attribution à la confirmation = **preuve de possession** de l'e-mail (impossible de voler le badge d'un autre). L'attribution unitaire et le CSV créent un grant en attente pour tout e-mail sans compte encore inscrit. **Perf — zéro N+1** : `account_badges: :badge` préchargé dans `CACHEABLE_ASSOCIATIONS` de `Status` (timelines : **1 requête groupée** par page, quel que soit le nombre de posts) **et** dans les ~14 contrôleurs de listes de comptes (abonnés/abonnements, notifications v1/v2, « aimé/partagé par », annuaire, listes, demandes de suivi, endorsements, suggestions) + `blocks`/`mutes` (`.preload` séparé pour éviter la multiplication de lignes du `eager_load`) — **mesuré 8→1** sur une liste de 8 comptes, `EXPLAIN`/compteur de requêtes à l'appui. **Fichiers core balisés `EPSILON`** (ledger) : `status.rb`, `account.rb`, `hover_card_controller.tsx`, `account_header/name.tsx` + `styles.module.scss`, `status/header.tsx`, `epsilon_sidebar.jsx`, `api_types/accounts.ts` + `models/account.ts`, `application.scss`, `routes.rb`, `navigation.rb`, `config/initializers/epsilon/extensions.rb`, `config/locales/en.yml`/`fr.yml`, + les ~16 contrôleurs de preload. Couverture de tests (contrôleur admin : CRUD, attribution pseudo/e-mail, CSV, grants en attente, persistance de l'icône ; service : attribution + attribution auto à la confirmation d'e-mail, e-mail casse-insensible ; specs de non-régression sur les endpoints de listes de comptes touchés).

- **Filtre de modération du flux en direct (médias sensibles / CW)** : Filtre réservé aux **modérateurs** sur les flux en direct (`/public`, `/public/local`, `/public/remote`) pour trier rapidement le contenu distant à modérer (surtout les images). Un **sélecteur segmenté** — masqué pour les utilisateurs normaux — propose trois modes : **Médias sensibles** (`sensitive`), **Avertissements (CW)** (`spoiler_text`), **Les deux** (défaut). **Backend** : paramètre `sensitive_scope` (`media`/`cw`/`all`) **additif** sur l'endpoint natif `/api/v1/timelines/public` ; `PublicFeed#sensitive_scope_filter` ajoute le `WHERE` correspondant à la chaîne de scopes publics existante — il ne fait donc que **restreindre** du contenu **déjà public** (aucune DM/abonnés-only/privé exposé). **Sécurité — défense en profondeur, modérateurs uniquement** : (1) le sélecteur n'est rendu que si `canManageReports(permissions)`, (2) le réglage n'est honoré côté front que pour un modérateur, (3) **garde serveur** `sensitive_moderation_scope` qui renvoie `nil` (aucun filtre) sauf si `current_user&.can?(:manage_reports)` (= Modérateur/Admin/Owner) — un non-modérateur qui forge la requête reçoit le **flux public normal**, sans erreur ni traitement spécial. La valeur du scope passe par un **whitelist** (`SENSITIVE_SCOPES` hash), pas d'injection possible. **Perf** : index partiel **`index_statuses_epsilon_sensitive_id`** (`WHERE sensitive OR spoiler_text <> ''`, ordonné `id DESC`, construit **`CONCURRENTLY`**, `strong_migrations`-safe et réversible) → requête **O(limit)** ; les trois modes sont couverts (les sous-ensembles `media`/`cw` sont **impliqués** par le prédicat, l'index reste utilisable), à re-mesurer en prod sur le mode `media` (2ᵉ index `WHERE sensitive` optionnel si besoin). **Front (sidecar, empreinte native minimale)** : toute la logique feed/streaming est isolée dans **`app/javascript/mastodon/epsilon/actions/moderation_feed.js`**, qui **réutilise les helpers génériques natifs** `expandTimeline`/`fillTimelineGaps`/`connectTimelineStream` (non modifiés) ; **streaming live conservé sans toucher le serveur Node** via le callback `accept` (filtrage client selon le scope, gère les reblogs) ; le header natif étant masqué dans la refonte UI, le sélecteur est un **contrôle custom dans le corps du flux** (`.firehose__mod-filter`). **Fichiers core balisés `EPSILON`** : `api/v1/timelines/public_controller.rb` (param + garde), `models/public_feed.rb` (scope), `features/firehose/index.jsx` (montage + aiguillage). Migration additive `20260915140000_add_epsilon_sensitive_index_to_statuses` (index seul, aucune structure de table native altérée).

- **Re-modération des posts publiés pendant une panne IA (fail-open backlog)** : Quand l'API Mistral échoue, un post fail-open est **publié sans verdict** et le restait pour toujours (aucun rattrapage). Désormais le chemin `sidekiq_retries_exhausted` **marque** ces posts (nouvelle colonne booléenne **`ai_failed_open`** sur `epsilon_ai_status_moderations`, index partiel `WHERE ai_failed_open = true`) et enregistre un événement d'audit **`fail_open`** (auparavant totalement silencieux). Un nouveau scheduler **`Epsilon::AiRemoderationScheduler`** (toutes les 15 min, queue dédiée `epsilon_ai_remoderation` en poids 1 sous le live) draine ce backlog : **auto-gaté** (skip si rien à faire ou kill-switch off ; **une sonde API** confirme que Mistral répond avant d'enfiler quoi que ce soit → jamais de martèlement d'une API morte) et **throttlé** (`RECHECK_BATCH = 50` plus vieux par run). Le worker **`Epsilon::AiRemoderationWorker`** re-analyse et applique le verdict **en place** (post déjà public, donc **pas de nouveau fan-out**) : approuvé → rien ; sensible → CW propagé en `update` ; review → signalement ; rejeté → takedown rétroactif non-destructif (strike + préservation) ou suppression si distant. API encore down → le flag reste posé, repêché au cycle suivant (pas de re-fail-open). **Bouton admin « Re-modérer maintenant »** sur `/admin/epsilon/ai_moderation_setting` (+ compteur santé `failed_open_count`) pour vider le backlog à la demande. Refactor : analyse Mistral et effets de verdict (report/strike/DM/CW) extraits en concerns partagés (`Epsilon::MistralAnalysis`, `Epsilon::ModerationVerdictActions`) réutilisés par le worker live et le worker de re-modération (zéro divergence). ⚠️ **DM privées non concernées** (v1 = fail-opens uniquement ; les `manual_review` du reaper, déjà signalés, sont hors scope). Couverture de tests (worker : chaque branche de verdict, API down, kill-switch, statut supprimé/déjà traité ; scheduler : sonde saine/morte, cap de lot, backlog vide, kill-switch ; contrôleur : autorisation + enqueue ; marquage fail-open + événement dans le worker live).

- **Retrait d'un content warning posé par l'IA** : Un modérateur peut lever un CW que l'IA a mis à tort (faux positif) — le post **reste publié**, seul l'avertissement est retiré (`sensitive: false` + effacement du spoiler IA, celui de l'auteur étant préservé), via `UpdateStatusService(bypass)` donc **fédéré sans re-modération**. Nouvelle colonne fiable **`ai_content_warning`** sur `epsilon_ai_status_moderations`, posée par le worker au verdict (`= must_be_sensitive`) : détection robuste (indépendante de la chaîne du spoiler, indexable) = flag ET `status.sensitive?` encore actif. Surfaces : filtre **« Avertissement »** sur la page de triage (`/admin/epsilon/ai_moderations`), plus un bouton **« Retirer l'avertissement »** sur la page de signalement **et** la page admin du statut (blocs balisés `EPSILON`, retour via `redirect_back`). Service `Epsilon::RemoveContentWarningService`, scope `AiStatusModeration.with_ai_content_warning`, helper `epsilon_ai_content_warning?`, backfill `rake epsilon:moderation:backfill_content_warnings`. Couverture de tests (service, helper, contrôleur, flag au verdict).

- **Page d'historique / audit de modération** (`/admin/epsilon/moderation_history`) : Trace permanente et statistiques de tout ce que l'IA modère. Nouvelle table **append-only** `epsilon_moderation_events` (une ligne par verdict : décision `approved`/`manual_review`/`rejected`/`reaper_released`, flag `sensitive` pour les CW, scores violence/vulgarité/sexuel, catégorie, motif, source, `acct` dénormalisé) — **découplée du cycle de vie du statut** pour survivre à la suppression et à la purge de rétention. Écrite depuis `MistralModerationWorker` (chaque verdict) et le reaper (fail-open). La page : **boutons de plage** (1 jour / 7 jours / 1 mois / 1 an / toujours) et **recherche par compte** qui pilotent un `scope` unique → tous les tableaux sont dynamiques ; compteurs totaux par décision + CW ; **découpage temporel** à granularité adaptative (jour → par heure, semaine/mois → par jour, an/toujours → par mois) ; **tendance de sévérité** (moyenne du pic des 3 critères — `AVG(GREATEST(violence, vulgarité, sexuel))` — par période, car c'est le max qui décide le verdict, pas un axe unique) ; **top des comptes les plus modérés** ; journal détaillé paginé, où **chaque ligne pointe vers la page admin native du statut** et vers son **signalement** quand il existe (deux requêtes groupées, sans N+1). **Perf** : toutes les agrégations en SQL (`GROUP BY date_trunc`, index sur `created_at`/`account_id`/`decision`), aucune ligne chargée en mémoire hors le journal paginé. Tâche de **backfill** `rake epsilon:moderation:backfill_events` (idempotente) pour peupler l'historique depuis les modérations + scores existants. **Perf (audité sur 1 M de lignes, `EXPLAIN ANALYZE`)** : le découpage temporel se fait en **une seule requête** à agrégation conditionnelle (`COUNT(*) FILTER (WHERE …)`) au lieu de 7 scans (mois : 693 → 37 ms, tout : 766 → 270 ms) ; **index GIN `pg_trgm`** sur `acct` → la recherche par compte (`ILIKE '%…%'`) devient index-backed (120 ms → **1,4 ms** sur données réalistes). Le journal détaillé est paginé (index scan sur `created_at`, ~0,04 ms). ⚠️ La migration active l'extension `pg_trgm` (`CREATE EXTENSION`, nécessite un rôle DB privilégié, une fois). Couverture de tests (modèle, enregistrement worker/reaper, contrôleur avec drill mensuel).

- **Filet de sécurité modération IA (reaper)** : Nouveau scheduler `Epsilon::AiModerationReaperScheduler` (toutes les minutes, queue `scheduler`) qui rattrape les statuts bloqués en `pending_ai`. Le fail-open normal passe par `sidekiq_retries_exhausted`, qui ne se déclenche que si le job Mistral a réellement tourné et épuisé ses retries ; un job **perdu avant exécution** (Sidekiq arrêté à l'enqueue, Redis vidé, deploy mal timé) laissait sinon le post gris/retenu **indéfiniment**. Le reaper repère les `pending_ai` plus vieux que 10 min (au-delà de toute exhaustion de retries) et les publie. Comme ces statuts n'ont **jamais** été analysés par l'IA, ils sont passés en **`manual_review`** (publiés mais **signalés** via `ReportService` pour qu'un humain les vérifie), plutôt qu'en `unmoderated` (publiés et considérés OK sans relecture). Chaque release est **isolée** (un statut bancal ne casse plus tout le lot) et **bornée** : nouveau compteur `reaper_attempts` sur `epsilon_ai_status_moderations`, la diffusion est tentée **avant** le changement d'état (un échec de fan-out garde le post en `pending_ai` pour un retry ultérieur plutôt que de le marquer publié sans livraison), et après 5 essais infructueux le statut est laissé de côté et loggé pour intervention humaine (plus de retry chaque minute à l'infini). **Index partiel** `index_epsilon_ai_status_moderations_pending` (sur `updated_at WHERE state = pending_ai`) : le balayage minute par minute devient une sonde d'index sur le petit sous-ensemble transitoire des `pending_ai` au lieu d'un seq scan croissant avec la table. Couverture de tests (release au-delà du délai, respect du délai de grâce, statuts déjà tranchés intacts, signalement créé, cap d'essais atteint, échec isolé au sein d'un lot).

- **Réponse en ligne à la demande sous un post ouvert** : Sur la page d'un post, le bouton « Répondre » du post ouvre désormais un composer **en ligne, déplié sous le post** (animation `grid-template-rows` qui pousse les réponses vers le bas, repli animé à la fermeture) au lieu de la modale. Répondre à une **réponse du fil** ouvre la **modale** classique, ciblée sur ce status. Fin du faux « Abandonner le brouillon » : un flag `epsilon_inline_owned` distingue le brouillon pristine (mention auto) d'un vrai brouillon. Sous coque iOS (WKWebView), `backdrop-filter` neutralisé dans le sous-arbre animé pour éviter le recalcul de flou par frame.
- **Widget de suggestions de catégories — « Afficher plus » + état de chargement** : Sans catégorie sélectionnée, le bouton « Valider » cède la place à un lien **« Afficher plus »** (→ `/categories`) avec un cross-fade entre les deux états ; à la validation, un **spinner « Préparation de votre fil… »** s'affiche pendant l'enregistrement (backfill synchrone) avant le rechargement.
- **Bouton « Retour » et action « Nouvelle liste » restaurés dans les en-têtes** : La règle qui masquait les en-têtes de colonne sans titre cachait aussi leur bouton retour (post ouvert, favoris, boosts, citations) — de nouveau affiché, en **bleu** comme le retour des pages de profil. Le « + » de création de liste, avalé par le masquage global des boutons d'en-tête, est ré-affiché de façon ciblée.

### Changed

- **Suppression de l'écran de consentement OAuth pour l'app iOS first-party** : Le login via l'app iOS Epsilon affichait la page Doorkeeper « Autoriser l'application » (écran de consentement du flux `authorization_code` + PKCE) au milieu du flux de connexion — friction inutile pour **notre propre app** se connectant à **notre propre instance**. Mastodon sautait déjà cet écran pour la web app officielle (flag `superapp`) ; le bloc `skip_authorization` de `config/initializers/doorkeeper.rb` est désormais étendu pour sauter aussi le consentement quand le client est l'app first-party, en réutilisant le helper existant `Epsilon::SessionBridge.first_party_application?` (identification par `EPSILON_FIRST_PARTY_CLIENT_ID`, déjà utilisé par le session bridge). **Fail-closed** : sans cet ENV, aucun client n'est bypassé (la page de consentement reste affichée pour tous les clients OAuth tiers). Couverture de tests (skip avec ENV posé, consentement affiché sans ENV).

- **Rejet IA non destructif + rétention configurable** : Un post rejeté par l'IA n'est plus **détruit** sur-le-champ. Avant, la modération appelait `RemoveStatusService` sans option → `permanently?` valait `true` (pas de report) → `destroy!` immédiat : contenu, scores et médias perdus, aucune trace, aucun recours possible. Désormais, sur un rejet local : (1) le strike (`AccountWarning`) est conservé, (2) un **signalement système** est créé (`ReportService`), ce qui rend le retrait **préservé** et le surface dans `/admin/reports`, (3) le statut est **soft-delete** (`RemoveStatusService(preserve: true)`) — masqué partout (profil, timelines, fédivers via une activité `Delete`) mais la ligne + les scores survivent et les médias passent en privé plutôt que d'être détruits. Un modérateur peut ainsi **lire, discuter et restaurer** un faux positif. Nouveau réglage `rejected_retention_days` (défaut **90 j**, `0` = illimité) sur `Epsilon::AiModerationSetting` + champ dans l'admin, et nouveau scheduler quotidien `Epsilon::RejectedContentPurgeScheduler` qui **hard-delete** (médias inclus) les rejets préservés au-delà de la fenêtre. Le contenu distant rejeté reste supprimé (copie locale). Couverture de tests (préservation vs destruction, création du report, purge au-delà/en-deçà de la fenêtre, rétention désactivée).

- **Rechargement fiable du fil à la validation des suggestions de catégories** : `window.location.href = '/home'` ne rechargeait pas quand on était déjà sur `/home` → `reload()` / `assign('/home')` pour que le fil se réactualise avec les posts des nouvelles catégories.
- **Modales « Signaler » et « Filtrer » (menu … d'un post)** : passées au style glass du thème (surface `--eps-surface`, bordure, coins arrondis, fin de l'assombrissement natif) ; barre de recherche du filtre en pill façon Explorer, liste et items stylisés.
- **Posts cités (quote)** : une seule bordure au lieu de deux imbriquées, quote un peu plus large (marge négative pour déborder du padding du post), et cartes média/lien **dé-nestées** (fin de la boîte-dans-la-boîte).
- **Modale de composition avec citation** : elle **grandit et scrolle** au lieu de tronquer (scroll sur l'overlay + centrage `margin: auto`) ; le post cité s'affiche **en entier** (fin du clip natif à 220px), encadré et espacé.
- **Lecteur vidéo flottant (picture-in-picture)** : carte glass arrondie (fin du fond transparent derrière la vidéo), badges d'en-tête remis en ligne, et **passé au-dessus des sidebars** (z-index).
- **Images seules dans les posts** : centrées au lieu d'être calées à gauche quand elles ne prennent pas toute la largeur.
- **Spinner de chargement plein-colonne** : repositionné (plus collé en haut de l'écran) à l'ouverture d'un post / d'une colonne.

### Fixed

- **Recherche sans effet au clavier logiciel iOS** : Depuis la barre de recherche (fil d'accueil / flux en direct), lancer une recherche depuis un iPhone ne faisait **parfois rien** — le texte semblait ignoré. Le composant `Search` (`features/compose/components/search.tsx`) ne soumettait **que** via un `keydown` Enter ; or la touche « rechercher »/« Go » du clavier logiciel iOS déclenche l'**événement `submit` du formulaire** (pas toujours un `keydown`, et l'autocorrect avale la 1ʳᵉ pression), et le `<form>` n'avait **aucun `onSubmit`** → la navigation vers `/search?q=…` n'était jamais déclenchée. Ajout d'un `handleSubmit` câblé sur `onSubmit` (balisé `EPSILON`). Desktop **inchangé** : le `keydown` Enter existant fait déjà `preventDefault()` et bloque la soumission implicite → pas de double-navigation. Reproduit et vérifié (soumission de formulaire vs `keydown` : avant → reste sur `/home`, `q=null` ; après → `/search?q=…`).
- **Débordement horizontal des flux à onglets** : Sur les pages à barre d'onglets (flux en direct « Ce serveur / Autres serveurs / Tout », notifications, profils), la page entière pouvait **scroller horizontalement** de ~8 px. Cause : `.account__section-headline` (règle partagée avec `.notification__filter-bar` / `.tabs-bar`) était en `box-sizing: content-box` avec `width: 100%` **+** la règle mobile `padding-inline: 8px` → boîte 16 px plus large que l'écran. Passage en `box-sizing: border-box`. La home n'ayant pas cette barre, elle n'était pas touchée (d'où « OK sur la home »). Vérifié à 320/360/375/390/430 px : débordement page 8–16 px → **0 px** partout.
- **Espacement sous la barre de recherche (mobile)** : Sur le flux en direct (`/public`) et la page recherche/explore, la barre de recherche collait au contenu. Ajout de 20 px de respiration en dessous, **aligné sur la home** (où l'écart vient du `margin-top: 20px` du compose inline). Scopé pour n'affecter que ces surfaces (le flux en direct via `:has(.search):not(:has(.epsilon-home-filter))`, la recherche via le `padding-bottom` mobile de `.explore__search-header`).

- **Badges empilés dans l'en-tête d'un post ouvert et le lecteur flottant** : une règle native (`.detailed-status__display-name span { display: block }`, idem PiP) forçait les `<span>` des badges en bloc → badges verticaux + « +N » étiré. Remis en ligne (`inline-flex`).

### Security

- **Les messages privés ne sont jamais modérés par l'IA** : Un statut en visibilité **`direct`** (message privé / mention privée) ne passe plus par la modération IA — analyser des conversations privées un-à-un est exclu par principe. Garde unique `return false if direct_visibility?` dans l'entonnoir `Epsilon::StatusExtension#epsilon_requires_moderation?`, qui couvre donc **création ET édition** (le chemin d'édition y délègue). Les posts `public`/`unlisted`/`private` (abonnés) restent modérés normalement. Tests : une DM reste `unmoderated` (aucun job worker), un post public du même compte reste `pending_ai`.

- **Fuite de fédération pendant la modération** : Un statut local en cours de modération (`pending_ai`) était retenu du fan-out **local** mais restait **fédéré aux instances distantes** — `PostStatusService` enqueue `ActivityPub::DistributionWorker` directement, que notre extension fan-out ne couvrait pas. Le contenu non encore modéré partait donc sur le fédivers avant le verdict. Nouvelle extension `Epsilon::ActivityPubDistributionWorkerExtension` (`prepend`) qui saute la fédération d'un `pending_ai` ; le statut est **re-fédéré une fois le verdict rendu** — à l'approbation (worker), à la libération du reaper (après le flip d'état, pour éviter que le job async ne voie encore `pending_ai`), et au fail-open (`sidekiq_retries_exhausted`). L'édition était déjà couverte (l'extension `UpdateStatusService` retient `broadcast_updates!` en entier, local + AP). Tests : blocage `pending_ai` / passage des statuts tranchés, fédération à l'approbation et à la libération reaper.

- **Modération IA à l'édition d'un statut** : Correction d'un contournement — un post édité n'était pas re-modéré (`UpdateStatusService` n'était hooké par aucune extension), donc « poster propre → être approuvé → éditer en n'importe quoi » passait la diffusion **et les notifications** sans aucun contrôle. Une édition est désormais traitée comme une _proposition_ : le nouveau contenu est appliqué mais sa diffusion est **retenue** tant que le statut repasse en `pending_ai` et est re-modéré (les abonnés continuent de voir la version approuvée précédente, sans clignotement). Sur approbation, l'édition est diffusée en `update`. Sur rejet, la version précédente (déjà approuvée) est **restaurée depuis l'historique d'édition** — non destructif, sans sanction (à la différence d'un post neuf rejeté, supprimé + strike) ; DM d'explication à l'auteur. Mêmes bypass que la création (staff / `EpsilonSafety` / kill-switch), et **fail-open** (si Mistral échoue, l'édition est publiée). Nouvelle extension `Epsilon::AiModerationUpdateStatusExtension` (`prepend`), worker `Epsilon::MistralModerationWorker` étendu (paramètre `is_edit`). Couverture de tests complète (extension + chemins approve/reject/revert du worker).

## [0.3.10] - 2026-09-11

### Added

- **Section « Contact & administration » sur la page /about (conformité App Store 1.2)** : Ajout d'un bloc de contact et de liens réglementaires sur la page `/about` custom d'Epsilon (`features/epsilon/about/index.jsx`), pour servir de **Support URL** sur la fiche App Store et de point de contact conformité Apple. Deux cartes distinctes dans le style `--eps-*` (piliers/manifesto) : **Support général** (`support@epsilon.social`) et **Signaler un contenu** (`moderation@epsilon.social`), cette dernière portant l'**engagement explicite d'examen de tout signalement sous 24 heures**. Adresses en `mailto:` cliquables, identiques FR/EN (constantes, hors chaînes traduites). Liens **Conditions d'utilisation** (`/terms-of-service`) et **Politique de confidentialité** (`/privacy-policy`) en dur dans la section — **indépendants du flag `termsOfServiceEnabled`**, donc visibles même si les CGU ne sont pas encore publiées dans l'admin. Page **accessible sans session** (vérifié : `AboutController#skip_before_action :require_functional!`, `require_functional!` gardé par `if: :user_signed_in?`, aucun `authenticate_user!`) → un reviewer Apple déconnecté y accède ; les non-connectés sur `/home` y sont déjà redirigés. Un futur mur de connexion sur les routes de contenu devra **whitelister `/about`**. i18n react-intl (clés `epsilon.about.contact.*`, EN régénéré via `i18n:extract`, FR à la main). Au passage : correction de l'offense ESLint préexistante `react/prop-types` sur `multiColumn`.

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
