# Session bridge — OAuth Bearer → session web Devise

La coque mobile Epsilon (Expo) affiche l'UI web dans une WebView. Le natif
s'authentifie avec un Bearer OAuth2 (Doorkeeper) persistant dans le Keychain ; la
WebView, elle, a besoin d'un cookie de session Devise qui **ne survit pas** à la
fermeture de l'app (`rememberable` est volontairement désactivé). Le pont
matérialise, à froid, une session web à partir du Bearer déjà présent — sans
ressaisie de l'email et du mot de passe.

## Flux

```
1.  POST /api/v1/epsilon/session_bridge
    Authorization: Bearer <token>
    → 200 { "token": "<bridge_token>", "expires_in": 30 }

2.  GET /auth/bridge?token=<bridge_token>
    → 302 /home, cookie de session Devise posé
```

Deux étapes pour que **le Bearer n'apparaisse jamais dans une URL** (historique,
`Referer`, logs). Le jeton de pont est aléatoire (`SecureRandom.urlsafe_base64(32)`),
à usage unique, valable 30 s ; passé sa consommation il n'a plus aucune valeur.

- Émission : `Api::V1::Epsilon::SessionBridgeController` + `Epsilon::SessionBridge::IssueService`.
- Consommation : `Auth::BridgeController` + `Epsilon::SessionBridge::ConsumeService`.
- Politique commune (clé Redis, app first-party, permissions staff) : `Epsilon::SessionBridge`.

## Garanties de sécurité

- **Usage unique atomique** : consommation par `GETDEL` (Redis 7 déployé). Jamais
  `GET` puis `DEL` — deux requêtes concurrentes ne peuvent pas réussir toutes deux.
- **TTL 30 s appliqué par Redis** (`SET … EX 30`), jamais en application.
- **Jeton stocké hashé** : la clé Redis est `session_bridge:<sha256(jeton)>`. Un
  dump Redis ne livre aucun jeton utilisable. La valeur stockée est
  `{ user_id, access_token_id }`.
- **Restreint à l'app first-party** : le token Doorkeeper doit appartenir à
  l'application dont le `uid` (client_id) est configuré via
  `EPSILON_FIRST_PARTY_CLIENT_ID`. Sans cette restriction, n'importe quel client
  OAuth tiers autorisé sur l'instance pourrait fabriquer une session web complète.
  **Fail-closed** : ENV absente ⇒ pont inerte.
- **Comptes staff refusés** aux deux endpoints : toute permission de modération,
  d'administration ou d'infra (`UserRole::Flags::CATEGORIES`) disqualifie le
  compte. L'interface `/admin` n'a aucun step-up ; un Bearer de modérateur dormant
  ne doit jamais devenir un panneau d'admin en écriture.
- **`reset_session` avant `sign_in`** : protection contre la fixation de session,
  et purge d'un éventuel `challenge_passed_at` (la session produite ne saute donc
  aucune reconfirmation de mot de passe).
- **Revalidation à la consommation** : le token Doorkeeper d'origine est rechargé
  et doit être `accessible?` (ni révoqué ni expiré) et appartenir au même
  utilisateur ; l'état du compte (`functional?`) est revérifié explicitement (le
  contrôleur ne peut pas s'appuyer sur `require_functional!`, personne n'étant
  encore connecté).
- **Messages d'erreur génériques** à la consommation : « inconnu », « expiré » et
  « déjà utilisé » renvoient le même 401, sans session créée.
- **Throttle Rack::Attack** : émission 10 / 5 min par user ; consommation
  60 / 5 min par IP.
- **Jetons hors des logs applicatifs** : `token` est déjà couvert par
  `config/initializers/filter_parameter_logging.rb` (`:token`, match partiel).

### Session produite = session de login normal

`sign_in(user)` déclenche le callback Warden `after_set_user`
(`config/initializers/devise.rb`), qui crée la `SessionActivation` (laquelle frappe
le token web `read write follow`) et pose le cookie signé `_session_id`. Le
callback `after_fetch` valide ensuite chaque requête contre `session_activations`.
La session pontée est donc strictement équivalente à celle d'un login, à deux
détails près, voulus :

- un `LoginActivity` est enregistré avec `authentication_method: :session_bridge`
  (seule trace forensique si un Bearer est volé et utilisé pour ponter) ;
- **`update_sign_in!` n'est PAS appelé** : le pont n'est pas une authentification
  nouvelle mais la matérialisation d'une auth déjà faite. Gonfler `sign_in_count`
  et `current_sign_in_at` à chaque cold start rendrait ces champs inutilisables
  pour repérer une vraie connexion suspecte.

## Réponses aux vérifications préalables (fork)

1. **Redis** : accès via `include Redisable` → `redis` (`RedisConnection.pool`).
   Serveur `redis:7-alpine` partout ⇒ `GETDEL` disponible, aucun fallback Lua.
2. **Création de session** : cf. « Session produite » ci-dessus — un simple
   `sign_in` suffit, tout le reste est porté par le callback Warden ; ni
   `session[:auth_id]` ni `activate_session` à manipuler à la main.
3. **Contrôleur API** : `Api::BaseController#current_resource_owner` →
   `User.find(doorkeeper_token.resource_owner_id)` ; `require_user!` gère l'état de
   compte ; scope insuffisant ⇒ 403 automatique, Bearer invalide ⇒ 401.
4. **Reconfirmation mot de passe** : email, mot de passe, suppression et migration
   de compte exigent le mot de passe courant ; la gestion TOTP passe par un
   « challenge » (fenêtre glissante 1 h). Le pont, qui n'a pas le mot de passe et
   ne pose pas de challenge, **ne peut pas** franchir ces surfaces.
5. **Rack::Attack** : `config/initializers/rack_attack.rb`.
6. **Filtrage des logs** : `:token` déjà filtré.

## Risque résiduel assumé

- **Query string du GET de consommation dans les access-logs nginx.** Atténué par
  le TTL + l'usage unique (au moment où quelqu'un lit ces logs, le jeton est mort),
  mais il faut néanmoins **exclure la query string de `/auth/bridge` de la
  journalisation nginx** (tâche ops, hors application Rails).

- **Escalade de portée d'un Bearer (structurel).** Le scope du Bearer entrant ne
  contraint pas la session produite : toute session web opère en `read write follow`
  et donne accès à des surfaces `Settings::` non re-protégées par mot de passe.
  Ce n'est pas une capacité nouvelle (toute session web l'a), mais le pont permet
  à un Bearer de devenir cette session. La restriction à l'app first-party ramène
  l'exposition à « quelqu'un qui détient le Bearer de l'app Epsilon », donc le
  téléphone déverrouillé. Les surfaces concernées, **hors périmètre de cette PR** et
  à traiter séparément si besoin :
  - **WebAuthn** : ajout/suppression de clé de sécurité sans challenge (si le TOTP
    est déjà activé).
  - **Applications OAuth** — chaîne de persistance à connaître :
    `session pontée → POST /settings/applications (aucun challenge) → lecture du
token propriétaire de l'app créée → token durable de scope arbitraire, qui
survit à un changement de mot de passe` (révoquer ce token n'est pas lié au
    reset password).

- **Comptes sans mot de passe.** Les cinq flags d'auth externe
  (`LDAP_ENABLED`, `PAM_ENABLED`, `CAS_ENABLED`, `SAML_ENABLED`, `OIDC_ENABLED`)
  sont désactivés en production, et aucun compte sans mot de passe n'existe. **Si
  l'un d'eux est activé un jour**, les comptes créés par ces providers ont un
  `encrypted_password` vide, donc `skip_challenge?` = vrai : la protection par
  challenge (gestion TOTP, désactivation 2FA) tombe pour eux. Le pont devra alors
  **refuser les comptes dont `encrypted_password` est vide**.
