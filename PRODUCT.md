# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people and businesses in Ethiopia who must trust a payment receipt is real before releasing goods, cash, or credit — verifying Telebirr, CBE, Dashen, and Bank of Abyssinia receipts via screenshot, QR, payment ID, or SMS.

Secondary: developers integrating Paid Verify API; admins operating the service.

## Product Purpose

Tamagn Tech (ታማኝ ቸክ) is a trusted Ethiopian receipt checker. Success means a user can confirm authenticity quickly and share a verification certificate for valid receipts.

## Positioning

Official-feeling verification for Ethiopian mobile-money and bank receipts, with multi-input verification (screenshot + QR, payment ID, SMS) and shareable certificates — not a generic OCR toy or bank-only portal.

## Constraints

- Existing Vite + React SPA (`client/`) and Express API (`server/`); better-auth cookie sessions.
- Preserve brand assets: `/deresegn-logo.svg`, foil gold / birr green / ink / parchment language already in tokens.
- Session boot must feel fast on deploy; do not replace in-app data skeletons (dashboard, admin) — only replace the **active-session fetch** gate.
- After session resolve: active session → home/dashboard (admin → `/admin`); no session → `/login`.
- Bilingual UI (English / Amharic) via existing locale system.

## Brand Commitments

- Names: **Tamagn Tech**, **ታማኝ ቸክ**, site tamagncheck.online.
- Visual identity already shipped in code (verification / banknote / guilloché world) — extend, do not rebrand.

## Accessibility

Honor `prefers-reduced-motion`; keep loading state announced for assistive tech; maintain readable contrast on parchment and dark ink surfaces.

## Confirmed Answers

- User confirmed inferred product facts (2026-08-08): audience, mechanism, splash routing (session → home/dashboard; guest → login), keep existing brand.
