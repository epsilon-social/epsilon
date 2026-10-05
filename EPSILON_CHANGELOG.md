# Epsilon Changelog

Toutes les modifications notables spécifiques au fork Epsilon sont documentées dans ce fichier.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Unreleased]

### Added

- **Piles anti-spam dans la home** : un auteur distant qui publie 3 posts ou plus dans la même heure d'horloge (fenêtres fixes 12h–13h, 13h–14h…) est replié en une « pile » à la position de son post le plus ancien (cartes empilées + bouton « Voir les N autres posts », dépli inline) — un compte prolifique n'occupe plus qu'un slot visible par heure. Groupement purement client (aucune donnée perdue, Redis intouché), home uniquement, comptes locaux et reblogs exclus, désactivable via le bouton Filtres (« Grouper les posts »). En complément, le backfill d'abonnement à une catégorie est plafonné à 3 posts par auteur. Le load-more au scroll est doublé d'un auto-remplissage (`scrollable_list`, balisé) : quand le repli (piles ou filtres home) rend le contenu plus court que le viewport, les pages suivantes se chargent seules jusqu'à remplir l'écran. Perf mesurée : sélecteur 0,5 ms sur une feed pleine (800 items), dépli d'une pile de 50 posts en ~185 ms à 60 fps. Au repli, la vue revient sur la pile (no-op si déjà visible) au lieu de laisser l'utilisateur échoué plus bas dans le fil. Sidecar : `epsilon/selectors/status_stacks.js` (+ tests), `epsilon/components/status_stack.jsx`, `styles/epsilon/components/status_stack.scss` ; core balisé : `features/ui/containers/status_list_container.js`, `components/status_list.jsx` ; backend : `workers/epsilon/categorization/subscribe_backfill_worker.rb` ; i18n `epsilon.status_stack.*`, `epsilon.home.filter.stacks`.

### Changed

- **Sidebar in-app : Accueil, Tendances, Notifications et Recherche rétablis** : ces entrées (doublons des onglets natifs de la coque) étaient masquées dans le tiroir in-app — elles réapparaissent pour tous ; la règle `epsilon-sidebar__item--in-app-hidden`, plus utilisée, est supprimée. NB : taper une de ces entrées empile la destination dans l'onglet natif actif au lieu de basculer d'onglet. Fichiers : `epsilon/components/epsilon_sidebar.jsx`, `styles/epsilon/layout.scss`.

## [0.3.25] - 2026-10-01

### Added

- **Bouton de suivi dans les posts** : bouton rond à droite du header de chaque post (fils, tendances, recherche, notifications, threads y compris le post ouvert — pas les profils ni les posts cités), pour suivre/ne plus suivre sans passer par le profil — indispensable dans la coque, où la hover card n'existe pas. Outline brand au repos, coche sur fond bleu plein une fois suivi, sablier si compte verrouillé en attente d'approbation ; animation bulle au suivi et à l'inverse (gatée reduced-motion), désabonnement via la modale native de confirmation. Slot réservé dès le rendu (bouton fantôme puis fondu) : aucun décalage de l'horodatage. Relations chargées en batch (une requête par page de fil, endpoint natif indexé + caché) ; debounce de `fetchRelationships` abaissé de 500 ms à 0 (flush au tick suivant, batching par page conservé, support `maxWait` ajouté au helper). Sidecar : `epsilon/components/status_follow_button.jsx`, `styles/epsilon/components/status_follow.scss` (nouveaux) ; core balisé : `components/status.jsx`, `features/status/components/detailed_status.tsx`, `actions/accounts.js`, `utils/debounce.ts`, `layout.scss` (press feedback) ; i18n `epsilon.status_follow.*`.

### Changed

- **Le fil public devient « Flux Epsilon »** : renommage dans la sidebar et le titre de la page/onglet navigateur via la nouvelle clé `epsilon.firehose.title` (« Epsilon feed » / « Flux Epsilon »), à la place des titres natifs par scope ; l'entrée remonte entre Accueil et Tendances (ordre aligné aussi pour les visiteurs non connectés). Empreinte native minimale : le bloc de titre natif reste intact, écrasé par une ligne balisée. Fichiers : `epsilon/components/epsilon_sidebar.jsx`, `features/firehose/index.jsx` (balisé), `locales/fr.json`.

- **Filtres du Flux Epsilon et bouton Filtres de la home unifiés** : les boutons « Media only » (tous les utilisateurs), « Contenu à modérer » et « Catégories » (modérateurs) partagent désormais le même langage que le bouton Filtres de la home, lui-même réaligné — texte et bordure bleu brand au repos, hover gris neutre (gaté `hover: hover` pour le tactile), état actif en fond brand plein texte blanc, retour d'appui (compression via le bloc press feedback global, gaté reduced-motion). Rangée alignée à gauche au-dessus du fil. Contraste élevé : texte `--eps-text-primary` au repos/hover, hover sur `--eps-surface-hover`, actif HC sombre en bleu clair/texte sombre (AA). Fichiers : `styles/epsilon/layout.scss` (styles + mixins HC), `features/firehose/index.jsx` (toggle « Media only » natif ré-exposé dans le corps du fil, balisé).

- **README remplacé par le README Epsilon** : notice de fork Mastodon v4.6.0, statut du self-hosting (non supporté, seeds et env documentés), attribution et licence AGPL (`README.md`).

- **Les posts restent affichés au désabonnement** : le fil visible n'est plus vidé des posts du compte désabonné (comportement natif court-circuité) ; côté serveur, les backfills de catégories sont ré-enfilés après l'unmerge — au rechargement, les posts relevant d'une catégorie souscrite restent dans le fil. Core balisé : `reducers/timelines.js` ; sidecar : `epsilon/categorization/unmerge_worker_extension.rb` (nouveau).

### Fixed

- **Fil bloqué sur « Préparation de votre flux principal… » pour les comptes abonnés à des catégories** : au premier follow alors qu'on ne suit encore personne, le natif masque le fil derrière l'écran de régénération jusqu'au passage du MergeWorker — qui n'arrive jamais pour un follow distant tant que l'Accept ActivityPub n'est pas revenu. Marquage sauté quand le compte a des abonnements de catégories (le fil n'est pas vide) ; et la régénération native (retour d'inactivité, vacuum) ne reconstruisant le fil que depuis les follows, les backfills de catégories sont ré-enfilés après — un compte « catégories seulement » ne perd plus son fil. Sidecar : `epsilon/categorization/{follow_service,precompute_feed_service}_extension.rb` (nouveaux), `config/initializers/epsilon/extensions.rb`.

- **Contraste élevé : scrim des modales natives assombri** (40 % → 72 %, aligné sur le scrim du compose) : le flou étant retiré en HC, l'assombrissement doit séparer seul la modale du fond. Visualiseur média inchangé (fond 92 %). Fichier : `styles/epsilon/layout.scss` (mixin `epsilon-flatten-glass`).

## [0.3.24] - 2026-09-30

### Changed

- **Formulaire d'inscription clarifié** : suffixe `@epsilon.social` retiré du champ identifiant (incompris des inscrits) ; règles affichées explicitement — identifiant : lettres sans accents, chiffres et tirets bas uniquement, pas d'espaces ni de points, 30 caractères max, avec un exemple sur sa propre ligne ; mot de passe : hint natif « au moins 8 caractères » réactivé. Fichiers : `app/views/auth/registrations/new.html.haml` (balisé), `config/locales/simple_form.{fr,en}.yml`, `config/locales/{fr,en}.yml` (clé `auth.sign_up.username_example`).

### Fixed

- **Bouton de modification bannière/avatar invisible (page Modifier le profil)** : le module natif lui donne un fond `--color-bg-primary`, remappé « transparent » par le thème Epsilon → bouton fondu dans l'image de bannière. Fond opaque `--eps-surface-solid` + hover opaque dérivé (`color-mix`), via hook sidecar. Fichier : `styles/epsilon/profile.scss`.

### Added

- **Filtre par catégories dans le Firehose (modérateurs)** : bouton « Catégories » à côté du filtre de contenu sensible — sélection multiple parmi les catégories actives (pill « Toutes » pour tout cocher/décocher), le fil ne montre que les posts catégorisés dedans (filtré côté serveur via `category_ids[]`, gaté `manage_reports`, cumulable avec le filtre sensible et « Media only », conservé dans les liens de pagination). Pas de stream live en mode catégories (la catégorisation est asynchrone) : fil à la demande. Index partiel `idx_epsilon_lpc_category_status_validated` sur `local_post_categorizations`. Core balisé : `public_feed.rb`, `api/v1/timelines/public_controller.rb`, `features/firehose/index.jsx` ; sidecar : `epsilon/actions/moderation_feed.js`, `epsilon/components/moderation_category_filter.jsx` (nouveau), spec de requête.

## [0.3.23] - 2026-09-29

### Added

- **Badges de téléchargement App Store dans le layout web** : badge officiel Apple (SVG, FR/EN selon la locale, lockup noir en thème clair / blanc en thème sombre via les nouvelles variables `--eps-display-on-light/dark` des mixins de thème) affiché dans la colonne de droite sous les catégories (>1024px) et dans le footer de la sidebar gauche en petit format (≤768px, drawer). Rien entre 769 et 1024px : le rail d'icônes (104px) ne peut pas contenir un badge conforme (minimum Apple 40px de haut, réduction interdite). Masqué dans la coque (`html.epsilon-in-app`). Badge Google Play affiché grisé, non cliquable, avec pastille « Bientôt disponible » FR/EN (`GOOGLE_PLAY_AVAILABLE = false` à basculer après validation Play Store, lien `social.epsilon.app` déjà câblé). Fichiers : `epsilon/components/epsilon_store_badges.jsx` (nouveau), `styles/epsilon/store_badges.scss` (nouveau), `images/epsilon/badges/` (6 SVG), `epsilon_layout.jsx`, `epsilon_sidebar.jsx`, `layout.scss`, `application.scss`.

### Fixed

- **Scroll horizontal causé par la ligne de version du footer** : la version (longue sur le fork) est `white-space: nowrap` dans le module natif → passée en `normal` (ciblage `li:last-child`, classe hashée) ; confinement `max-width` + `overflow-wrap: anywhere` généralisé du mode rail à tous les breakpoints (`layout.scss`).
- **Liens du footer clippés en mode rail (769–1264px) + styles footer morts depuis la 4.6** : `LinkFooter` est passé en CSS module à l'upgrade 4.6 (classes hashées) — tous les styles epsilon ciblant `.link-footer` étaient du code mort (d'où liens soulignés et débordement : le `<footer>`, flex item centré, prenait sa largeur fit-content ~130px dans le rail de 104px et était clippé des deux côtés par l'`overflow` de la colonne). Styles réécrits sur `footer[data-context='default']` : base (0.75rem, sans soulignement, hover) + rail 769–1264px (`max-width: 100%`, 0.59rem centré, `overflow-wrap: anywhere`) ; drawer ≤768px sur les défauts du module. Reproduit et validé via harnais Playwright. Fichier : `styles/epsilon/layout.scss`.

### Changed

- **Seuil d'entrée des posts tendances abaissé de 5 à 2 interactions** (reblogs + favoris, `threshold` dans `app/models/trends/statuses.rb`) — adapté à une petite instance ; decay et demi-vie natifs conservés.

- **Explorer s'ouvre sur les suggestions de comptes** : `/explore` redirige côté SPA vers `/explore/suggestions` (connecté) ou `/explore/posts` (anonyme) au lieu d'afficher les posts tendances, souvent vides sur une petite instance — corrige notamment l'onglet Explorer de la coque mobile, sans rebuild d'app. Les posts tendances restent accessibles via l'onglet « Posts » (`/explore/posts`, route déjà servie par le wildcard Rails). Fichier core balisé `EPSILON` : `app/javascript/mastodon/features/explore/index.tsx`.

## [0.3.22] - 2026-09-28

### Fixed

- **Specs natives réalignées sur le fork (run RSpec global de 7704 exemples, premier depuis un moment)** : 7 assertions attendaient un `noscript` contenant « Mastodon » alors que la chaîne `noscript_html` dit « Epsilon » depuis UI v5 (21/09, PR #40) — `spec/system/{about,home,privacy,statuses,tags,terms_of_service}_spec.rb`. Et la spec CSP attendait le seul hash sha256 natif (`theme-selection.js`) alors que les deux scripts inline Epsilon (`epsilon-in-app-context.js`, `epsilon-locale-refresh.js`) en ajoutent chacun un à `script-src` — hashes désormais calculés dynamiquement via `InlineScriptManager` (suivront les futurs edits de ces fichiers) : `spec/requests/content_security_policy_spec.rb`. Aucun autre échec réel : le reste de la suite est vert.

- **Catégorisation des posts locaux réparée (course avec l'attachement des hashtags)** : Les posts locaux n'étaient quasiment jamais catégorisés (7 sur 603 en prod sur 7 jours), donc absents des fils par catégorie — alors que le contenu distant y arrivait bien. Cause : le worker de catégorisation était enclenché par un `after_commit on: :create` sur `Status`, qui part **avant** que `PostStatusService` attache les hashtags (`postprocess_status!`) ; le worker lisait une association `tags` vide et classait le post « non classé », sans retry. Le chemin distant, lui, attache les tags dans la transaction de création (d'où l'asymétrie). Fix : le callback modèle est restreint aux statuts distants, et les posts locaux sont enclenchés après `process_hashtags_service` via `Epsilon::Categorization::PostStatusExtension` (prepend sur `PostStatusService`). Rattrapage des posts jamais catégorisés : `rake epsilon:categorization:backfill_local[30]` (fenêtre en jours). Fichiers : `app/models/concerns/epsilon/categorization/status_extension.rb`, `app/services/concerns/epsilon/categorization/post_status_extension.rb` (nouveau), `config/initializers/epsilon/extensions.rb`, `lib/tasks/epsilon/categorization.rake` (nouveau).

## [0.3.21] - 2026-09-27

### Fixed

- **Scroll une-doigt réparé dans la coque Android (WebView Chromium)** : Le fil ne défilait plus au doigt sur Android (le geste à deux doigts, si). Cause : la règle `overflow-x: clip` posée sur la racine `<html>` en in-app (écrêtage du débordement horizontal de page) fait que Chromium traite le viewport comme non-scrollable lors d'un geste à un doigt — comportement propre à Blink, sans effet sur le scroll vertical côté WebKit (iOS). La règle est désormais scopée à WebKit via une nouvelle classe `epsilon-in-app-webkit`, posée sur `<html>` uniquement quand `window.GestureEvent` existe (API WebKit, absente de Chromium) — détection de capacité, pas de chaîne UA. `epsilon-in-app` reste posée sur les **deux** plateformes → la barre de navigation web du bas reste masquée sur Android (la tab bar native la remplace). Fichiers : `app/javascript/inline/epsilon-in-app-context.js`, `app/javascript/styles/epsilon/layout.scss`.

- **Comportements in-app iOS restreints à WebKit** : Deux gardes écrits et testés pour iOS gênaient Android une fois la coque déployée. (1) L'anti-zoom de page — events WebKit `gesturestart/change/end` + un `touchmove` **non-passif permanent** (`preventMultiTouchZoom`, qui maintient la séquence tactile annulable pour bloquer le pinch démarré en cours de scroll) — n'a de sens que sur WebKit et cassait le scroll Chromium. (2) La désactivation de la virtualisation du fil (tous les items montés), motivée par l'absence d'`overflow-anchor` sur WebKit, est inutile sur Chromium (ancrage natif) et y gonflait la mémoire sur longs fils. Les deux sont désormais gatés sur `window.GestureEvent`. Fichiers : `app/javascript/inline/epsilon-in-app-context.js`, `app/javascript/mastodon/components/scrollable_list/intersection_observer_article.jsx`.

## [0.3.20] - 2026-09-25

### Added

- **Sondages : nombre maximum d'options porté de 4 à 10** (`MAX_OPTIONS` dans `app/validators/poll_options_validator.rb`).
- **Crédit Storyset** en bas de la page « À propos » (lien cliquable) — attribution requise par la licence des illustrations libres.

### Changed

- **Écran d'erreur : illustration remplacée** par une illustration libre (`public/oops.svg`), à la place de l'éléphant Mastodon (`oops.gif` / `oops.png`).
- **Mascotte remplacée** par une illustration libre (`app/javascript/images/elephant_ui_plane.svg`, même nom conservé) — compose, annonces, mascotte par défaut.
- **Indicateur « préparation du fil » remplacé** par une illustration libre (`public/loading.svg`), à la place de l'éléphant animé (`loading.gif` / `loading.png`).
- **États vides : illustration remplacée** par une illustration libre (`app/javascript/images/elephant_ui.svg`, même nom conservé) — onglet « Mis en avant », collections, listes admin.

### Fixed

- **Recherche de comptes : classement corrigé (Elasticsearch)** : Trois pathologies du tri natif corrigées — un compte à **0 abonné** avait un score strictement nul quelle que soit la pertinence textuelle (facteur popularité multiplicatif → passé en **additif**, `boost_mode: sum`) ; une requête multi-mots (« compte à rebours ») noyait le match exact sous les milliers de comptes ne matchant qu'un seul mot (désormais **tous les termes requis**, `combined_fields`, adapté du draft PR mastodon#37403) ; la page de résultats ne matchait que des mots entiers, « presidentielle » ne trouvait pas `@presidentielle2027` (**préfixes** via les sous-champs `edge_ngram` déjà indexés, adapté de PR mastodon#40627 ; réf. issue mastodon#35968). Sidecar pur : `Epsilon::AccountSearchRankingExtension` (prepend sur les query builders d'`AccountSearchService`), **aucune réindexation nécessaire**. Fichiers : `app/services/concerns/epsilon/account_search_ranking_extension.rb` (nouveau), `config/initializers/epsilon/extensions.rb`.

- **Toggle « Média uniquement » ré-exposé dans le flux en direct** : La refonte UI masque le dropdown de réglages du `ColumnHeader` (`.column-header__collapsible` / `__setting-btn`), qui était le **seul** contrôle du filtre natif « Media only » (`firehose.onlyMedia`). Conséquence : un utilisateur l'ayant activé (avant la refonte, ou par accident) restait **coincé** à ne voir que les posts avec média, **sans aucun moyen visible de le désactiver** — et retirer le filtre de modération n'y changeait rien, `onlyMedia` étant un réglage **séparé** appliqué au fil de base. Le toggle est désormais **ré-exposé en pill dans le corps du Firehose** (visible pour tous, dans la même rangée que le filtre de modération), pilotant le **même réglage natif** `firehose.onlyMedia` (préférence UI par compte dans `Web::Setting`) — aucun nouvel accès, endpoint ni requête (chemin natif `only_media` inchangé). Corrige aussi le fait qu'aucun nouvel utilisateur ne pouvait plus (dés)activer « Média uniquement » depuis la refonte. **Fichiers core balisés `EPSILON`** : `features/firehose/index.jsx` (+ `styles/epsilon/layout.scss`). Aucune migration (front pur).

## [0.3.19] - 2026-09-24

### Added

- **Deep links mobiles (Universal Links iOS + App Links Android)** : Le domaine sert les deux fichiers d'association attendus par les OS — `/.well-known/apple-app-site-association` (iOS) et `/.well-known/assetlinks.json` (Android) — pour que les liens `epsilon.social` s'ouvrent dans les apps natives, notamment le lien de confirmation d'inscription (qui ouvrait Safari). Contrôleurs sidecar `Epsilon::WellKnown::*` servant un fichier versionné en `application/json`, 200 sans redirection ni session ; fédération inchangée. L'AASA exclut les routes techniques (`/auth/bridge`, `/oauth`, `/api`, `/admin`, `/sidekiq`, `/pghero`, `/auth/sign_in`) et n'ouvre l'app que sur le contenu et `/auth/confirmation`.

## [0.3.18] - 2026-09-23

### Fixed

- **Changement de langue in-app appliqué sans relancer l'application (coque iOS)** : Dans la coque, changer la langue de l'interface n'avait aucun effet visible tant qu'on ne **tuait pas l'app pour la relancer**. Cause structurelle : la locale de l'UI est lue **une seule fois au boot** depuis `<html lang>` (baké côté serveur depuis `user.locale`), et la coque garde **une WebView persistante par onglet (4 au total)** qu'elle ne recharge jamais (switch d'onglet, retour au premier plan), le retour se faisant en `history.go(-1)` (restauration bfcache, pas un reload). Le changement de langue passe par un rendu serveur complet sur `/settings/preferences/appearance` → seul l'onglet qui a fait ce rendu voyait la nouvelle langue ; les autres restaient figés jusqu'au relaunch. **Correctif 100 % web, aucune modification de la coque** (déployable sans nouvelle soumission App Store) : nouveau script inline sidecar `app/javascript/inline/epsilon-locale-refresh.js`, **scopé in-app** (UA `EpsilonMobile/`, verrou identique à `epsilon-in-app-context.js`) et chargé sur toutes les pages via `layouts/application.html.haml` (les réglages sont rendus par ce layout, cf. `admin.html.haml` → `render template: 'layouts/application'`). À chaque rendu frais, il **publie le `<html lang>` rendu comme source de vérité partagée** dans `localStorage` (partagé entre les 4 WebViews de même origine) + un cookie ; toute page dont le `lang` figé diffère de cette vérité **se recharge elle-même** — instantanément dans les autres onglets (event `storage` / `BroadcastChannel`, reload invisible en arrière-plan), sur restauration bfcache (`pageshow`), ou quand l'onglet revient au premier plan / est touché (`visibilitychange`/`focus`/`pointerdown`). **Piloté par événements, sans timer/polling** (batterie) ; écrire une valeur **inchangée** ne déclenche aucun event → la navigation normale ne réveille jamais les autres onglets, seul un **vrai** changement de langue le fait. **Garde anti-boucle** (`sessionStorage` + horodatage, fenêtre 8 s) pour le cas hors-ligne où un reload de navigation échoue sans corriger le `lang` (le service worker de Mastodon **n'intercepte pas** les requêtes de navigation → jamais de HTML `lang` périmé servi depuis le cache), tout en autorisant une reprise après reconnexion. **CSP préservée** (hash SHA256 ajouté à `script-src` par `javascript_inline_tag`). **Web / PWA strictement inchangés** : le script s'arrête au premier `return` (verrou UA) — zéro cookie, zéro listener, zéro reload ; côté web le changement de langue déclenche déjà un vrai rechargement via la redirection Rails. Compromis connu et accepté : le reload d'un onglet réinitialise son état SPA, donc un **brouillon de compose non envoyé** dans un onglet de fond au moment précis du changement de langue serait perdu (le relaunch — contournement actuel — le perd de toute façon). **Fichiers** : `app/javascript/inline/epsilon-locale-refresh.js` (nouveau), `app/views/layouts/application.html.haml` (une ligne balisée `EPSILON`). Vérifié en preprod (TestFlight).

## [0.3.17] - 2026-09-22

### Added

- **Bouton afficher/masquer le mot de passe (pages d'auth)** : Les pages d'authentification server-rendered (inscription, connexion, réinitialisation) n'offraient aucun moyen de vérifier le mot de passe saisi. Un bouton œil est désormais injecté dans chaque `input[type="password"]` du shell `.epsilon-auth` : il bascule le champ entre `password` et `text` et échange l'icône (`visibility`/`visibility_off` du jeu material, déjà présentes au dépôt). Composant JS vanilla autonome `entrypoints/epsilon/password_reveal.ts` (chargé par `public.tsx`, même modèle que la modale de confirmation de suppression), libellés localisés via `epsilon_auth.show_password`/`hide_password` (en + fr, `default:` de repli pour les autres langues), style dans `styles/epsilon/auth.scss`. Accessible (`<button type="button">`, `aria-pressed`, `aria-label` localisé, atteignable au clavier) ; les honeypots (champs `text`/`url`) ne sont jamais décorés. Couvre inscription / connexion / réinitialisation (tout champ mot de passe sous `.epsilon-auth`). Tests Vitest.
- **Avance automatique du focus sur la date de naissance** : Sur le triple champ jour/mois/année, dès qu'une case atteint sa longueur max le focus saute à la suivante, et `Backspace` sur une case vide revient à la précédente (caret placé en fin, pour enchaîner les suppressions). Câblage suivant l'**ordre du DOM** → fonctionne quel que soit l'ordre imposé par la locale (JJ/MM/AAAA en fr, AAAA/MM/JJ en en) et respecte le `maxlength` de chaque case (2 pour jour/mois, 4 pour l'année). Composant sidecar `entrypoints/epsilon/dob_autotab.ts` (chargé par `public.tsx`) + tests Vitest.
- **Ligne de contact support sous les formulaires d'auth** : Sous la connexion **et** l'inscription, une ligne discrète invite à écrire au support si un problème de connexion/création de compte persiste. Partial partagé `auth/shared/_support_hint.html.haml` rendu sur les deux pages, adresse tirée de **`Setting.site_contact_email`** (via `mail_to`, donc rien codé en dur) et **affichée uniquement si l'e-mail de contact est renseigné** (sinon rien, pas de lien cassé). i18n en + fr (`epsilon_auth.support_hint_html`), style `.epsilon-auth__support-hint` dans `styles/epsilon/auth.scss`. (Livré dans une PR de suivi séparée du reste de la 0.3.17.)

### Changed

- **Date de naissance — dimensionnement et localisation** : Trois ajustements sur le triple champ de `/auth/sign_up` (visible seulement si `Setting.min_age` est renseigné). (1) **Cases élargies** — le natif dimensionne les inputs à 32px en `content-box`, tassés une fois la hauteur min de 48px de la refonte appliquée ; élargis (2 chiffres = 64px, année = 92px, ciblés par `maxlength` donc indépendants de l'ordre de la locale), chiffres centrés + `tabular-nums` (`styles/epsilon/auth.scss`). (2) **Placeholders localisés** — le natif code en dur `DD/MM/YYYY` (anglais même sur une page FR) ; désormais lus via i18n (`simple_form.placeholders.user.date_of_birth_{1i,2i,3i}`, en + fr, repli sur la valeur native) → **FR `JJ/MM/AAAA`**, EN `DD/MM/YYYY`, via un **prepend sidecar** `Epsilon::DateOfBirthInputExtension` sur `DateOfBirthInput` (câblé dans `config/initializers/epsilon/extensions.rb` ; le corps recopie `#input` du natif, à re-synchroniser lors d'un upgrade). (3) **Libellé du champ** — la clé `simple_form.labels.user.date_of_birth` manquait en FR (SimpleForm retombait sur l'anglais « Date of birth ») → ajout de **« Date de naissance »**.
- **Libellé de l'étape « Confirmer le courriel »** : Dans le stepper d'inscription, `auth.progress.confirm` valait en FR « Confirmer l'adresse de courriel » (31 car.), trop long pour la boîte de libellé (position absolue, `width: 100px`) → wrap sur 3-4 lignes et **débordement** sous les pastilles depuis la refonte. Raccourci en **« Confirmer le courriel »** (cohérent avec l'anglais « Confirm email » et les libellés voisins qui, eux, tiennent).

### Fixed

- **Espaces dans le nom d'utilisateur supprimés automatiquement (déblocage d'inscription)** : Le natif normalise le username avec `squish`, qui retire les espaces en début/fin mais **conserve un espace interne** (ex. « jean dupont »), ensuite **rejeté** par la validation de format → inscription bloquée sur un caractère souvent **invisible** (espace insécable U+00A0 d'un copier-coller, tabulation d'un autocomplete mobile). Un `before_validation` sidecar (`Epsilon::UsernameNormalizationExtension`, câblé dans l'initializer) retire désormais **tous** les caractères d'espacement (`gsub /[[:space:]]+/`), **scopé aux comptes locaux** (`if: :local?`) pour préserver le comportement natif sur les comptes **distants** (un espace interne y reste correctement rejeté). Couvert par des specs RSpec, dont un **test de garde** local vs distant.

## [0.3.16] - 2026-09-22

### Added

- **Ouverture du compose depuis l'onglet « New Post » natif (pont `epsilon:compose`)** : Dans la coque mobile, la barre d'onglets native a un bouton « New Post » qui n'est pas une destination mais une commande : il doit ouvrir notre modale de composition sans changer d'onglet ni vider de pile. La coque envoie pour cela un message `epsilon:compose` sur le pont ; côté web, **personne ne l'écoutait** (bouton mort), ce qui bloquait la sortie Android. Le listener existant de `features/epsilon/native_bridge/index.tsx` (déjà en place pour `epsilon:open-menu`) prend désormais en charge `epsilon:compose` sur le **même modèle** : mêmes gardes (données string uniquement, `JSON.parse` sous try/catch, rejet de tout type hors préfixe `epsilon:`), et il **réutilise l'action exacte** des boutons « New Post » de la sidebar et de la barre du haut — `useEpsilonCompose().openCompose()` (le bridge est monté à l'intérieur de `EpsilonComposeProvider`, le contexte y est donc résolu). **Gaté sur `signedIn`** pour coller à ces boutons (masqués aux invités) ; message d'invité ignoré. `openCompose` est **idempotent** : re-déclenché modale déjà ouverte = no-op, le brouillon (state Redux `compose`) n'est jamais touché ni réinitialisé. L'ouverture émet déjà `epsilon:web-overlay` source `compose` (via la modale) → la tab bar native se masque d'elle-même, rien à ajouter. **Limite connue et acceptée** (identique à `epsilon:open-menu`) : sur les pages Rails server-rendered (`/settings/*`, `/auth/*`) la SPA n'est pas montée, donc le pont non plus — l'onglet n'y fait rien.
- **Animation d'entrée de la modale de composition** : La modale apparaissait « d'un coup » (affichage instantané). Elle a désormais une entrée soignée : le contenu **monte légèrement en fondu** (`translateY` + micro-échelle + opacité, courbe ease-out sans rebond — ouverture au tap, sans élan → critically damped, principe Apple) et le **scrim s'assombrit progressivement** en fondu. Contrainte iOS majeure gérée par design : sur WKWebView, **animer une couche portant `backdrop-filter` recalcule le flou à chaque frame = jank** (raison pour laquelle une tentative précédente avait été retirée). Ici le **flou est isolé sur une couche `::before` fixe** et le contenu animé n'a aucun flou dans son sous-arbre → l'animation reste 100 % compositor (`transform`/`opacity`), sans recalcul de flou. Repli **`prefers-reduced-motion`** (simple fondu, sans translation ni échelle) et **état de base `opacity: 0`** pour neutraliser le flash de première frame de WebKit (backwards-fill non honoré au montage). Fichier `styles/epsilon/epsilon_compose_modal.scss` ; commentaire de `layout.scss` mis à jour.

### Fixed

- **Saut du compose à l'ouverture depuis la tab bar native (in-app)** : Ouvert depuis l'onglet natif « New Post », le compose **sautait** en pleine animation ; ouvert depuis la sidebar (via le drawer, qui a déjà masqué la tab bar), il était parfait. Cause : à l'ouverture, on émet `epsilon:web-overlay('compose')` → la coque **masque la tab bar native** → la WebView **s'agrandit** → le contenu centré (`margin: auto`) **se re-centre en plein milieu de l'animation** = le saut. Correctif scopé in-app (`.epsilon-in-app`) : on **garde le centrage** mais on **retarde l'apparition du contenu** (`animation-delay`) le temps que la tab bar se masque et que le viewport se stabilise — grâce à `opacity: 0` + backwards-fill, le contenu reste invisible pendant le re-centrage, puis se révèle **déjà centré** dans le viewport final (le scrim, lui, s'affiche immédiatement). Hors coque (aucune tab bar native), le centrage reste inchangé.

### Changed

- **Contraste élevé — scrim et bordures des surfaces glass** : En contraste élevé (réglage OS `prefers-contrast: more`, transparence réduite, ou l'option in-app `html[data-contrast='high']`), le fork **aplatit le verre** (`backdrop-filter` retiré), ce qui privait plusieurs surfaces de leur séparation d'avec le fond devenu opaque. Trois ajustements : (1) **scrim de la modale compose assombri** (`40%` → `72%` de noir, via un nouveau token `--eps-compose-scrim`) pour compenser le flou perdu ; (2) **bordure de la carte compose et des dialogues** (report/mute/filter, sur `--eps-compose-border`) remontée dans les mixins `epsilon-contrast-light/dark` (le bord restait à ~8 % → invisible) ; (3) **bordure ajoutée à la carte de navigation grand-format** de la sidebar (`.epsilon-sidebar__nav`), qui ne comptait que sur `surface` + `box-shadow`, alignée sur le rail moyen-format qui l'avait déjà. Discret en rendu normal (hairline), franc en contraste élevé. Fichiers `styles/epsilon/epsilon_compose_modal.scss` et `layout.scss`.

## [0.3.16] - 2026-09-21

### Changed

- **Nouvel avatar par défaut (v3)** : Itération du visuel de repli des comptes sans photo (silhouette dans un cercle, 400×400 PNG). Mécanisme de versioning inchangé (cf. 0.3.15) : `EPSILON_DEFAULT_MEDIA_VERSION` bumpé `2` → `3`, nouveaux PNG déposés sous `public/avatars/original/v3/missing.png` + `public/headers/original/v3/missing.png`. Les fichiers `v2/` sont **conservés** (des clients au cache API un peu ancien peuvent encore les demander → éviter les 404). Aucun changement JS → déploiement léger (pas de precompile, simple restart web).

## [0.3.15] - 2026-09-21

### Changed

- **Avatar par défaut dé-mastodonisé** : L'avatar de repli des comptes sans photo était encore l'illustration Mastodon ; remplacé par un nouveau visuel Epsilon (silhouette bleu-gris sur fond clair, 400×400 PNG). Tout compte sans photo (local ou distant) l'affiche automatiquement.
- **Cache-busting de l'avatar par défaut** : Le placeholder est un fichier statique non-fingerprinté, mis en cache plusieurs semaines par les navigateurs ; un simple remplacement de fichier laisserait les clients existants sur l'ancienne image. L'URL par défaut servie par Paperclip est donc **versionnée par le chemin** (`/avatars/original/v<N>/missing.png`) via l'initializer sidecar `config/initializers/epsilon/default_avatar.rb` (surcharge `Paperclip::Attachment.default_options[:default_url]`) → le nouveau visuel se propage immédiatement à tous. Versioning **par le chemin et non `?v=N`** : Mastodon échappe les URLs d'assets (`?` → `%3F`, lien cassé — d'où son `use_timestamp: false`). Le template `default_url` étant global, il couvre aussi le header par défaut : les deux fichiers versionnés doivent exister (`public/avatars/original/v2/missing.png` + `public/headers/original/v2/missing.png`). La sentinelle front `nullIfMissing` (`onboarding/profile.tsx`) passe de `endsWith` à `includes('missing.png')` pour rester compatible avec le chemin versionné. **Pour changer le visuel par défaut : bumper `EPSILON_DEFAULT_MEDIA_VERSION` ET déposer les PNG sous `v<N>/`.**

## [0.3.14] - 2026-09-21

### Changed

- **Nouveau logo Epsilon (petit symbole / marque)** : Remplacement de la marque « petit logo » par le nouveau logo (carré arrondi `#4571FF` + glyphe). Plusieurs assets étaient **encore ceux de Mastodon** : `images/logo-symbol-icon.svg` était le **glyphe « m »** de Mastodon et `images/app-icon.svg` l'**icône Mastodon** (gradient violet). Trois fichiers mis à jour : **`images/logo.svg`** (marque de la sidebar gauche + `SymbolLogo`), **`images/app-icon.svg`** (source des **favicons / apple-touch-icons**, rasterisés au build), et **`images/logo-symbol-icon.svg`** (composant `IconLogo` in-app + **mask-icon Safari**) — ce dernier ré-enveloppé en `<symbol id="logo-symbol-icon" viewBox="0 0 1024 1024">` avec un id de `clipPath` renommé (`epsilon-logo-icon-clip`) pour éviter toute collision une fois inliné dans le DOM à côté du wordmark. Couleur du **mask-icon** (onglet épinglé Safari) `#6364FF` → **`#4571FF`**. Le **wordmark n'est pas modifié**. ⚠️ **Favicon en prod** : le helper `favicon_path`/`app_icon_path` renvoie l'image **uploadée en admin** (`SiteUpload`, vars `favicon`/`app_icon`) si elle existe — `app-icon.svg` n'est que le **fallback**, donc la mise à jour du favicon prod se fait **dans l'admin → Branding**. Note connue : le **mask-icon** (silhouette mono-couleur) rendra un carré arrondi bleu uni (le glyphe ne ressort pas), une variante monochrome dédiée serait nécessaire pour l'onglet épinglé.
- **Fallback `<noscript>` dé-Mastodonisé** : Le repli sans JavaScript (`shared/_web_app.html.haml`, visible uniquement JS désactivé) contenait encore `alt: 'Mastodon'` et un lien `joinmastodon.org/apps`. Passé à `alt: 'Epsilon'` et message simplifié à « Pour utiliser Epsilon, veuillez activer JavaScript. » (clé `errors.noscript_html` en/fr, lien « applications natives » retiré ; argument `apps_path` supprimé du template).

## [0.3.13] - 2026-09-21

### Added

- **Pinch-to-peek des images du fil (in-app iOS)** : Comme le zoom de page est désactivé dans la coque, pincer une image **directement dans le fil** la fait maintenant grossir/prévisualiser façon Instagram (« peek »), sans ouvrir le visualiseur plein écran. Composant sidecar autonome `features/epsilon/image_peek/index.tsx` (+ styles `styles/epsilon/image_peek.scss`, importés via `application.scss`), monté globalement depuis `epsilon/components/epsilon_layout.jsx`. Il capte les gestes de pincement au niveau du document et, pour un pincement **hors média**, **avale le geste** pour que la page ne reste pas « collée » zoomée (`swallow non-media pinches`), en complément des gardes de `epsilon-in-app-context.js`.

### Changed

- **Dropdown de suggestions de recherche opaque** : `.search__popout` était translucide + `backdrop-filter`, ce qui rendait bien dans la sidebar droite mais **translucide sur `/search`** (un ancêtre neutralisait le flou). Passé à un **fond blanc solide** via un nouveau token réutilisable **`--eps-surface-solid`** (`#fff` clair / `#1a1c21` sombre), sans flou ni gradient, bordure `--eps-border` → rendu **identique et opaque** dans tous les contextes (`styles/epsilon/layout.scss`).
- **Visualiseur média plein écran — fond net + pinch/pan fluides** : Les règles génériques de modale ajoutaient au viewer un overlay **flou + 40 % transparent** (on voyait le fil derrière la photo) et un conteneur à **coins arrondis** (masque re-rasterisé à chaque frame) → zoom/pan lents et laids. Scopé au viewer via `:has(.media-modal)` : overlay **noir solide 92 %** sans `backdrop-filter`, conteneur `border-radius: 0`, `will-change: transform` sur l'image. Le zoom/pan **suit le doigt 1:1** (`features/ui/components/zoomable_image.tsx`, `styles/epsilon/layout.scss`).

### Fixed

- **Feedback d'erreurs de formulaire de nouveau affiché** : Depuis la refonte UI, certaines erreurs ne s'affichaient plus (ex. image de bannière/avatar trop lourde sur `/start/profile` → rien à l'écran, seulement en console). `updateAccount` étant un thunk **legacy** qui rejette sans action `*_FAIL`, il court-circuitait l'`errorsMiddleware` global (qui, lui, toaste déjà toutes les erreurs des thunks RTK). Ajouts sur l'onboarding profil (`features/onboarding/profile.tsx`) : **pré-validation client 8 Mo** (avatar/header) avec message précis avant tout appel serveur, **erreurs inline** via `CalloutInline` (images + champs), **toast de secours** (`showAlertForError`) pour les échecs non structurés (incl. 413), et **bouton « Terminer » désactivé** tant qu'un champ est en erreur (erreurs effacées dès qu'on modifie le champ). Côté `/categories` (`features/epsilon/category_settings/index.jsx`), l'`alert()` navigateur est remplacé par un **toast**. Nouvelle clé i18n `onboarding.profile.image_too_large` (en + fr). L'audit a confirmé que le reste des formulaires in-app reste couvert (toasts globaux + styles d'erreur natifs intacts).
- **Bannières de profil rognées à la taille recommandée (1500×500)** : Le natif utilise une **hauteur fixe** (120/160 px) avec `object-fit: cover` ; combiné à l'inset « carte » de la refonte, la boîte dérivait du ratio 3:1 et **rognait la bannière** (les côtés en format étroit, le haut/bas en large). Verrouillage de la boîte en **`aspect-ratio: 3 / 1`** (+ `height: auto`) sur la **vue publique** (`account_header__header`) **et** la **preview d'édition** (`account_edit__profileImage`) → une bannière 1500×500 s'affiche **en entier** à toute largeur (`styles/epsilon/profile.scss`).
- **Durcissement anti-zoom in-app (iOS) — double-tap & focus de champ** : Le garde `gesturestart` de la coque ne bloquait que le **pinch à froid**. Deux autres voies de zoom subsistaient. (1) **Double-tap-zoom** sur un bouton (reply, quote…) laissait la page zoomée jusqu'au redémarrage → `touch-action: manipulation` sur les contrôles tappables (`html.epsilon-in-app`). (2) **Auto-zoom au focus** d'un champ de `font-size < 16px` → plancher **16px** in-app sur tous les champs focusables (CW/spoiler, `.simple_form textarea`/`select`, `.input-copy`, recherche catégories, textarea auth, react-select hashtags) + recherche sidebar/emoji remontées directement. **Apple-safe** (aucun `maximum-scale`/`user-scalable=no`). Portée : tous les cas via override `html.epsilon-in-app` (web intact) — `/settings/*` et `/auth/*` reçoivent bien la classe (rendus via `layouts/application`). Fichiers `styles/epsilon/layout.scss`, `epsilon_compose_modal.scss`.
- **Faille de zoom : 2ᵉ doigt posé pendant un scroll** : On pouvait encore zoomer/dézoomer en posant un second doigt **en cours de scroll** — `gesturestart` ne se déclenche pas quand un pinch démarre au milieu d'une séquence tactile déjà active, donc les 3 listeners existants le rataient. Ajout d'un **garde `touchmove` multi-touch** dans `epsilon-in-app-context.js` : présent dès le premier contact (iOS fige la « cancelability » d'une séquence à son début → un garde armé tardivement serait ignoré), **non-passif mais early-return à 1 doigt** (le scroll garde son chemin rapide), n'annule que les gestes **≥ 2 doigts** et **laisse le visualiseur média** (`.zoomable-image`) faire son propre pinch. In-app uniquement (UA-gated `EpsilonMobile/`).

## [0.3.12] - 2026-09-20

### Added

- **Modale de confirmation avant suppression de compte (App Store 5.1.1(v))** : La page `/settings/delete` demandait le mot de passe puis supprimait directement au submit ; Apple exige une **confirmation explicite** de l'utilisateur avant une action destructive. Un **dialog de confirmation** stylé (langage des modales Epsilon : backdrop flouté, surface glass, tokens `--eps-*`, bouton de suppression au **rouge natif** `.negative` — `--color-bg-error-base`/`-hover`, thème clair/sombre suivi) s'interpose désormais entre le clic « Supprimer le compte » et la suppression réelle : boutons **Supprimer le compte / Retour**, fermeture au clic sur le fond, à `Escape` ou sur « Retour » (= annulation, aucune suppression). La page de suppression étant **server-rendered (Haml, hors SPA React/Redux)**, la modale est un composant **JS vanilla autonome** (`app/javascript/entrypoints/epsilon/confirm_modal.ts`, chargé par `public.tsx`) qui **intercepte le submit** du formulaire natif via `delegated-events`, l'affiche, et ne resoumet qu'à la confirmation (piège à focus, verrou de scroll, retour du focus à la fermeture). **Champs requis** : `Form::DeleteConfirmation` n'ayant aucune validation de présence, le champ mot de passe (ou username) passait à vide ; il est désormais `required` (HTML5) — le navigateur bloque le submit à vide **avant** l'ouverture de la modale, doublé d'un garde JS `checkValidity()`/`reportValidity()`. Générique : tout formulaire opte in via `data-confirm-modal` + les libellés localisés `data-confirm-*`. **Traductions FR/EN** dans les locales Ruby (`config/locales/{en,fr}.yml`, bloc `deletes.confirm_modal`), donc éditables à la main (pas de passage par `en.json`). **Fichiers core balisés `EPSILON`** : `app/views/settings/deletes/show.html.haml` (data-attributes + champs `required` sur le formulaire), `app/javascript/entrypoints/public.tsx` (import), `app/javascript/styles/application.scss` (`@use`). Nouveau partial `styles/epsilon/epsilon_confirm_modal.scss`.

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
