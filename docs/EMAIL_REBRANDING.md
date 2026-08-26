# Epsilon — Rebranding des emails

> Rebranding complet du style des emails transactionnels (fork Mastodon 4.6, design `mailer-new`) vers l'identité Epsilon.
> Contrainte : les clients mail ne rendent ni les variables CSS, ni `backdrop-filter`, ni le mesh radial. Le rebrand est une **version « à plat »** de l'ADN Epsilon — couleurs solides, radius généreux, logo.

Date : 2026-08-20 · Branche : `stye/email-rebranding`

---

## Décisions figées (avec l'utilisateur)

1. **Header** : bannière **sombre re-teintée** (pas de mesh-PNG). Noir neutre web `#16171a` au lieu du purple-black Mastodon `#1b001f`.
2. **Accent (liens, texte de marque)** : **`#5d95ff`** — aligné sur `--eps-brand-primary` du thème **clair** web (les mails sont light-mode only).
3. **Bouton CTA primaire** : **brand `#5d95ff` fond / `#fff` texte** (hover `#3d7ae6`). _(Choix retenu après comparaison : le noir `#111` façon bouton web rendait l'email trop monochrome — le bleu unifie CTA + icônes + wordmark. Revenir au noir = changer `$eps-btn-bg`/`$eps-btn-bg-hover`.)_
4. **Logos** : générés depuis les SVG Epsilon existants — pas de Figma.

---

## Architecture existante (audit)

Style **centralisé** : malgré 88 templates, le branding tient dans peu de fichiers.

| Rôle                                             | Fichier                                                                  | Lignes     |
| ------------------------------------------------ | ------------------------------------------------------------------------ | ---------- |
| **Toutes les couleurs + fonts**                  | `app/javascript/styles/entrypoints/mailer.scss`                          | 1076       |
| **Layout + `<title>` + alt-text logo**           | `app/views/layouts/mailer.html.haml`                                     | 92         |
| **Partials partagés** (button, heading, cartes…) | `app/views/application/mailer/*.haml`                                    | 8 fichiers |
| **Logos email**                                  | `mailer-new/common/logo-header.png` (314×80) + `logo-footer.png` (88×88) | —          |
| **45 PNG illustrés**                             | `mailer-new/{heading,welcome,welcome-icons,store-icons}`                 | 608 Ko     |

**Pipeline** : templates HAML → layout inclut `vite_stylesheet_tag 'styles/entrypoints/mailer.scss'` → Vite compile → **premailer-rails** (`config/initializers/premailer_rails.rb`, stratégie `PremailerBundledAssetStrategy`) inline le CSS dans le HTML final. Light-mode uniquement (`supported-color-schemes: light`), table-based, compatible Outlook MSO.

**État de départ** : 0 personnalisation Epsilon dans les mails — 100% Mastodon stock.

### Assets de marque Epsilon disponibles (vecteurs SPA)

- `app/javascript/images/logo.svg` → icône app « Ep. » (carré blanc arrondi, périwinkle `#5675FA`).
- `app/javascript/images/logo-symbol-wordmark.svg` → wordmark « Epsilon social » (`currentColor` + accent `#5675FA`).
- ⚠️ `logo-symbol-icon.svg` est **encore l'éléphant Mastodon** — ne pas l'utiliser.
- ⚠️ Tous les PNG sous `mailer/` et `mailer-new/` sont **encore Mastodon**.

---

## Mapping couleurs (source de vérité) — `mailer.scss`

| Rôle                             | Mastodon  | Occ. | → Epsilon     | Note                   |
| -------------------------------- | --------- | ---: | ------------- | ---------------------- |
| Marque (liens, accents)          | `#6364ff` |    8 | **`#5d95ff`** | brand web light        |
| Marque hover                     | `#563acc` |    5 | **`#3d7ae6`** | brand assombri         |
| Header / bannière sombre         | `#1b001f` |    3 | **`#16171a`** | noir neutre web        |
| Texte principal                  | `#17063b` |   14 | **`#111`**    | text-primary web       |
| Texte secondaire                 | `#746a89` |   15 | **`#666`**    | text-secondary web     |
| Texte footer                     | `#9b94ab` |    2 | **`#999`**    | gris clair             |
| Sous-titre header (sur sombre)   | `#a399a5` |    1 | **`#8e929d`** | secondary dark web     |
| Fallback header MSO (sur sombre) | `#8d808f` |    1 | **`#8e929d`** | idem                   |
| Fond page (lavande)              | `#f3f2f5` |    4 | **`#f7faf0`** | crème web aplati       |
| Fond section extra               | `#f0f0ff` |    1 | **`#eef7f6`** | cyan très doux         |
| Frame emphasis                   | `#efefff` |    2 | **`#eef4ff`** | teinte brand douce     |
| Fond/bordure mini-carte          | `#e8e6eb` |    2 | **`#e7ebf0`** | neutre froid           |
| Bordures cartes                  | `#dfdee3` |    5 | **`#e5e7eb`** | bordure solide (email) |
| Checklist checked (fond)         | `#eaf6f1` |    1 | **`#e8f7f5`** | cyan doux              |
| Checklist checked (bordure)      | `#c4e6d7` |    1 | **`#bfe6df`** | cyan                   |
| Texte bouton sur bannière        | `#181820` |    1 | **`#111`**    | inchangé de fait       |
| Blanc                            | `#fff`    |   17 | `#fff`        | inchangé               |

**Boutons CTA** : `.email-btn-table` bg `#6364ff` → **`#111`** ; hover `#563acc` → **`#333`** ; texte `#fff` inchangé.

---

## Assets à régénérer

| Cible                                         | Source                     | Traitement                                                                                                |
| --------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `mailer-new/common/logo-header.png` (≈314×80) | `logo-symbol-wordmark.svg` | rasteriser en **blanc** (`currentColor`=#fff) pour le header sombre ; accent `#5675FA`/`#5d95ff` conservé |
| `mailer-new/common/logo-footer.png` (88×88)   | `logo.svg`                 | rasteriser l'icône « Ep. » (fond blanc arrondi)                                                           |
| `header-bg-start/end.png`                     | —                          | à décider (garder texture actuelle re-teintée, ou fond uni `#16171a`)                                     |
| `heading/*.png` (20 icônes par type)          | Mastodon-stylées           | **Phase 2** — recolorer/épurer selon ambition                                                             |
| `welcome*` illustrations                      | Mastodon-stylées           | **Phase 2**                                                                                               |

---

## Plan par phases

### Phase 1 — Rebrand centralisé (≈80% de l'impact, previewable)

- [ ] `mailer.scss` : appliquer le mapping couleurs ci-dessus (balisé `EPSILON`).
- [ ] `mailer.html.haml` : `<title>` Mastodon → Epsilon ; alt-text logos → « Epsilon » ; header bg → `#16171a`.
- [ ] Générer `logo-header.png` (blanc) + `logo-footer.png` (icône « Ep. ») depuis les SVG.
- [ ] Preview via ActionMailer (`/rails/mailers` en dev) sur welcome + une notif + un email auth.

### Phase 2 — Assets illustrés

- [x] ~~Header background~~ : textures Mastodon retirées (header aplati $eps-dark) en Phase 1.
- [x] **Icônes `heading/`** : 9 violettes (`#6364ff`) recolorées → brand `#6393FF` via `magick -modulate 100,100,90`. Sémantiques gardées : vert `#2DA771` (succès ×4), rouge `#C03A3A` (danger ×6), ambre `#D0881B` (login ×1).
- [ ] Illustrations welcome (feature cards = captures UI Mastodon, steps, App Store/Play).
- [ ] Textes littéraux « Mastodon » dans locales Ruby (`about.hosted_on`, apps) — décision branding globale.

### Phase 3 — QA multi-clients

- [ ] Rendu Gmail / Outlook (MSO) / Apple Mail.
- [ ] Vérif light-mode + fallback texte (`.text.erb`).

---

## Conventions

- Modifs de fichiers core Mastodon (mailer.scss, layout, partials) balisées `// EPSILON : EMAIL REBRANDING` (SCSS) / `-# EPSILON : EMAIL REBRANDING` (HAML).
- Nouveaux assets Epsilon : pas de flag (mais documentés ici).
- Ne pas éditer `en.json`/locales via ce chantier (voir CLAUDE.md).
  </content>
  </invoke>
