---
name: Tamagn Check
description: Official Ethiopian receipt verification — parchment, foil gold, birr green, guilloché.
colors:
  ink: "#0E2420"
  birr-green: "#1B463A"
  foil-gold: "#C6A24E"
  light-gold: "#E4C977"
  parchment: "#F4EEDC"
  verified: "#3E8F62"
  maroon: "#7C2A33"
  parchment-subtle: "#efe6d4"
  parchment-overlay: "#e8dcc8"
  text-secondary: "rgba(14, 36, 32, 0.65)"
  text-tertiary: "#888888"
  text-on-dark: "#F4EEDC"
  border: "rgba(14, 36, 32, 0.12)"
  border-strong: "rgba(14, 36, 32, 0.2)"
  bg-elevated: "#ffffff"
typography:
  display:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "clamp(1.85rem, 5.5vw, 2.45rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "clamp(1.4rem, 4.4vw, 1.8rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.06em"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  xl: "12px"
  seal: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  stage: "28rem"
components:
  button-primary:
    backgroundColor: "{colors.foil-gold}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.light-gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.parchment-subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-ghost-gold:
    backgroundColor: "transparent"
    textColor: "{colors.parchment}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  input-default:
    backgroundColor: "{colors.bg-elevated}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 14px"
  card-surface:
    backgroundColor: "{colors.bg-elevated}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px"
  method-stamp:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.parchment}"
    typography: "{typography.label}"
    rounded: "0"
    padding: "0.55rem 0.4rem"
  seal-mark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.seal}"
    size: "4.75rem"
---

# Design System: Tamagn Check

## Overview

**Creative North Star: "The Guilloché Certificate"**

Tamagn Check reads as official Ethiopian payment verification — banknote atmosphere, not a SaaS dashboard. Surfaces sit on warm parchment under a faint gold guilloché field; ink and birr green carry authority; foil gold marks trust, progress, and accents. The brand names itself at hero scale (Tamagn Check / ታማኝ ቸክ) before any secondary message.

Density stays ceremonial and sparse on promotional and boot surfaces: one composition, one seal, one act of copy, one soft gold progress cue. Product UI (dashboard, forms) reuses the same palette and Fraunces display voice with tighter Inter body copy and restrained white elevated cards — still parchment-rooted, never purple chrome or flat gray app chrome.

**Key Characteristics:**
- Full-bleed parchment + guilloché atmosphere before chrome
- Foil gold as scarce trust metal; birr green for verification voice
- Fraunces for brand and act titles; Inter for reading; IBM Plex Mono for amounts/IDs
- Seal / receipt / certificate silhouettes as the visual grammar
- Hard clip-cuts for act changes; soft foil progress; honor `prefers-reduced-motion`

## Colors

Four brand metals on parchment: deep ink, institutional birr green, foil gold, and warm paper. Semantic success/error map onto verified green and maroon.

### Primary
- **Foil Gold** (`{colors.foil-gold}`): Trust metal — progress rails, foil rings, bilingual brand alt, primary buttons, borders on method stamps. Use sparingly so it stays precious.
- **Light Gold** (`{colors.light-gold}`): Hover lift for foil-primary controls.

### Secondary
- **Birr Green** (`{colors.birr-green}`): Verification voice — act titles, Prove/Certify seal fills, dark hero bands. Signals “official check,” not decoration.

### Tertiary
- **Verified Green** (`{colors.verified}`): Positive confirmation marks (certificate check, valid status).
- **Maroon** (`{colors.maroon}`): Refusal / error ink aligned with banknote caution.

### Neutral
- **Tamagn Ink** (`{colors.ink}`): Primary text, Trust-act seal mark, method-stamp fields, navbar dark.
- **Parchment** (`{colors.parchment}`): Base page and session-open field.
- **Parchment Subtle / Overlay** (`{colors.parchment-subtle}`, `{colors.parchment-overlay}`): Secondary button and layered paper steps.
- **Elevated White** (`{colors.bg-elevated}`): Interactive cards and inputs only.
- **Text Secondary / Tertiary** (`{colors.text-secondary}`, `{colors.text-tertiary}`): Supporting copy and meta.
- **Border** (`{colors.border}`, `{colors.border-strong}`): Hairline structure at ink opacity, not gray chrome.

### Named Rules
**The Foil Scarcity Rule.** Foil gold is metal, not fill paint — progress, rings, borders, and primary CTAs. Do not flood large backgrounds with gold.

**The Parchment Field Rule.** Boot and promotional first viewports are full-bleed parchment with guilloché; white cards are for interaction containers, not the hero plane.

## Typography

**Display Font:** Fraunces (with ui-serif, Georgia)
**Body Font:** Inter (with ui-sans-serif, system-ui)
**Label/Mono Font:** IBM Plex Mono for amounts, payment IDs, and tx meta; Fraunces uppercase for ceremonial labels (progress hints, method stamps)

**Character:** Optical serif authority for the product name and verification acts; quiet sans for body; mono for machine-readable money facts.

### Hierarchy
- **Display** (700, `clamp(1.85rem, 5.5vw, 2.45rem)`, lh 1.1): Brand lockup on session open and hero-level naming.
- **Headline** (600, `clamp(1.4rem, 4.4vw, 1.8rem)`, lh 1.2): Act titles and section drama in birr green or ink.
- **Title** (700, 36px / `--text-3xl`): Page titles in product chrome.
- **Body** (400, 15px / `--text-base`, lh 1.7): Act bodies and general reading; max ~24rem on centered boot copy.
- **Label** (600, ~0.75–0.78rem, 0.04–0.06em, uppercase): Session hints and method stamps.
- **Mono** (500, 11–28px by role): Balances, IDs, certificate codes.

### Named Rules
**The Brand-First Type Rule.** On branded first viewports, the product name outranks the act headline in size and weight; no supporting line may overpower Tamagn Check / ታማኝ ቸክ.

**The Bilingual Pair Rule.** Always show the active locale brand with the alternate script as foil-gold secondary line (English ↔ Amharic).

## Layout

Session open and auth-adjacent boots are single-column, centered stages (`min(100%, 28rem)`), vertically centered in `100dvh` with `place-items: center`. Padding ~2rem / 1.25rem; tighten inline to 1rem below 420px. Content widths elsewhere: `--width-content` 680px, `--width-wide` 960px, `--width-full` 1280px with 16px container gutters.

Boot composition budget: seal → brand → brand-alt → one act block → optional method grid (Prove only) → 2px gold progress → uppercase hint. No stats, cards, or nav on that plane.

Rhythm favors 8px multiples (0.4–1.75rem gaps observed on the open stage). Act block holds `min-height` (~6.25–6.75rem) so title swaps do not jump the progress rail.

## Elevation & Depth

Depth is mostly tonal: parchment field, soft radial foil/birr glow behind the seal, ink mark with a single soft drop. Product cards use hairline ink borders and light ink-tinted shadows (`--shadow-sm/md/lg`). No neon glow, no multi-layer purple haze.

### Shadow Vocabulary
- **Seal presence** (`box-shadow: 0 10px 28px -8px rgba(14, 36, 32, 0.35)`): Under the centered seal mark only.
- **Control rest** (`--shadow-sm: 0 1px 2px 0 rgb(14 36 32 / 0.06)`): Primary/secondary buttons at rest.
- **Control lift** (`--shadow-md: 0 4px 12px -2px rgb(14 36 32 / 0.08)`): Primary hover.
- **Panel** (`--shadow-lg: 0 12px 24px -4px rgb(14 36 32 / 0.1)`): Larger elevated panels when needed.

### Named Rules
**The Ink-Tinted Shadow Rule.** Shadows take Tamagn ink RGB, never pure black or colored glow stacks.

**The Flat Field Rule.** The guilloché parchment plane stays flat; elevation belongs to seals, controls, and interactive cards.

## Shapes

Corners stay modest: 4px on primary foil buttons, 8px on cards/inputs, 12px where larger soft corners appear, ~16px (`1rem`) on the seal mark square. Method stamps are square-cornered ink tiles with a 1px foil border — stamp, not pill.

Recurring silhouettes: circular foil progress ring around the seal; rounded-rect seal mark; receipt and certificate line icons cut in with hard clip reveals. Guilloché is concentric circles/ellipses in foil at ~4–7% opacity, tiled (~200–220px).

### Named Rules
**The No-Pill Stamp Rule.** Ceremonial method labels are rectangular ink stamps with foil edges, not rounded-full chips.

**The Seal Geometry Rule.** Trust identity lives in a rounded square mark inside a circular foil ring — preserve that pairing on boot/title surfaces.

## Components

### Buttons
- **Shape:** Gently squared (4px primary / ghost-gold; 8px secondary family)
- **Primary:** Foil gold fill, ink text, 10×20 padding, light lift on hover to light-gold
- **Secondary:** Parchment-subtle fill, strong border, ink text
- **Ghost / Ghost-gold:** Transparent; ghost-gold for dark/birr bands with parchment text and foil hover border
- **Hover / Focus:** 150ms standard ease; primary/secondary lift `-1px`; inputs take 3px foil muted focus ring

### Cards / Containers
- **Corner Style:** 8px
- **Background:** Elevated white on parchment pages
- **Shadow Strategy:** Hairline ink border first; soft ink shadow secondary
- **Internal Padding:** 24px typical
- **Rule of use:** Cards only when they hold interaction or structured records — never in the session-open hero

### Inputs / Fields
- **Style:** White fill, 1.5px ink-border at rest, 8px radius, 11×14 padding, Inter sm
- **Focus:** Foil border + `0 0 0 3px` primary-muted ring
- **Error:** Maroon border on error-muted wash

### Navigation
Dark ink navbar (`--color-bg-navbar`) with parchment/foil accents; keep chrome off the session-open gate entirely (App mounts open page until the sequence finishes).

### Session Seal (signature)
Centered 7.5rem seal (6.5rem on narrow). Foil ring draws once (`stroke-dashoffset` 327→0, 480ms). Mark is ink on Trust, birr green on Prove/Certify. Logo or receipt/certificate silhouette swaps with a 200ms hard clip cut. Brand + foil brand-alt sit under the seal; acts cycle Trust → Prove → Certify (~520ms each); Prove stamps a 2×2 method grid; 2px track with foil bar reports act progress.

### Method Stamp (signature)
Uppercase Fraunces labels on ink, parchment text, 1px foil border, zero radius — four verification methods only (Screenshot · QR · Payment ID · SMS).

## Do's and Don'ts

### Do:
- **Do** open branded boots on full-bleed parchment with guilloché and a centered foil seal before any dashboard chrome.
- **Do** keep foil gold scarce and birr green as the verification title color.
- **Do** pair English and Amharic brand lines on first viewport naming.
- **Do** use hard clip-cuts for act/icon changes and soft width transitions for progress; disable motion under `prefers-reduced-motion`.
- **Do** treat cards and white surfaces as interaction containers on parchment, not as the hero.

### Don't:
- **Don't** replace the session gate with a dashboard skeleton, spinner-only void, or generic app splash.
- **Don't** put stats, schedules, promo chips, or floating badges over the open-field hero.
- **Don't** use rounded-full pills for ceremonial method labels.
- **Don't** flood screens with purple gradients, cream-and-terracotta defaults, or glow stacks foreign to this banknote world.
- **Don't** let act copy outsize or outrank the Tamagn brand lockup on title surfaces.
