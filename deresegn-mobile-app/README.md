# Deresegn Mobile App

Tamagn Tech / ታማኝ ቸክ React Native (Expo) client. Mirrors the web app in `../client` against the Express API in `../server`.

## Phase 1 (done)

- Expo app shell + Tamagn brand theme tokens
- EN / AM i18n (ported catalogs)
- Secure session cookie store (SecureStore) + better-auth sign-in/sign-up/sign-out/get-session
- API client with `X-Tamagn-Client: 1` + `X-Tamagn-Platform: mobile` (server CSRF allows mobile)
- Redux auth slice (login, signup, session, hydrate `/users/me`, logout)
- Splash session gate, Login, Register, Admin stub
- Role routing: admin → AdminHome, client → MainTabs, guest → Auth

## Phase 2 (done)

- Bottom tabs: **Home | FAB Verify | History** (mirrors web `BottomNav`)
- Home: balance card, last verification, pull-to-refresh, top-up + verify entry points
- History: list, search, bank filters, detail sheet
- Balance + check history Redux slices (`GET /balance`, `GET /check/history`)
- Onboarding modal once (`AsyncStorage` key `deresegn_onboarding_seen`)
- Verify + top-up **placeholder** modals (full flows in Phase 3–4)

## Phase 3 (done)

- Full verify wizard (`CheckerModal`): bank → mode → screenshot / payment ID / SMS
- Redux: `performCheck`, `performReferenceCheck`, `performSmsCheck` + balance/history refresh
- Image pick (camera + library) + compress via `expo-image-manipulator`
- Multipart upload without forcing JSON `Content-Type`
- Success/failure UI (certificate snapshot, summary, issues, cost)

## Phase 4 (done)

- Full top-up wizard (`TopUpModal`): Telebirr/CBE → screenshot / payment ID / SMS
- Receiver accounts from `GET /balance/topup-accounts`
- Redux: `submitTopUp`, `submitTopUpReference`, `submitTopUpSms`
- Developer API screen: packages, buy / renew / revoke / reveal, copy key, wallet top-up
- Home entry: **Get API** button + key icon

## Phase 5 (done)

- Shareable certificates: copy link, native share, open in browser (`EXPO_PUBLIC_WEB_URL` + `/verify/:token`)
- Full cert card on verify success + history detail
- Admin read-only console (`GET /admin/dashboard`): stats, recent checks/top-ups, bonus banner
- Polish: dark status bar on parchment, login/register safe areas, network error helper i18n

## Setup

```bash
cd deresegn-mobile-app
cp .env.example .env
# edit API URLs for your machine / simulator
npm install
npm start
```

Run server first:

```bash
cd ../server
npm run dev   # default http://localhost:5000
```

### API URL tips

| Runtime | Suggested `EXPO_PUBLIC_API_URL` |
|---------|----------------------------------|
| Android emulator | `http://10.0.2.2:5000/api` |
| iOS simulator | `http://localhost:5000/api` |
| Physical phone | `http://<your-LAN-IP>:5000/api` |

Also set `EXPO_PUBLIC_AUTH_URL` to the same host + `/api/auth`.

## Auth approach

Browsers use httpOnly cookies. React Native:

1. POST `/api/auth/sign-in/email` or `sign-up/email`
2. Persist session from `Set-Cookie` and/or JSON `token` into **SecureStore**
3. Send `Cookie: ...` on later requests
4. Server `csrfOriginGuard` allows mutating requests that carry  
   `X-Tamagn-Client: 1` + `X-Tamagn-Platform: mobile` (cannot be set by classic cross-site form posts)

## Scripts

- `npm start` — frees port **8081**, then starts Expo on **8081** (always)
- `npm run android` / `npm run ios` / `npm run web` — same free-port + Expo on 8081
- `npm run export:android` / `npm run export:ios` — production JS bundles (Metro)
- `npx expo-doctor` — config health check

## Project layout

```
src/
  api/             # http, session store, unwrap, bases
  features/        # auth, balance, checks Redux slices
  i18n/            # en + am + LocaleContext
  context/         # DashboardUi (verify / top-up open state)
  navigation/      # RootNavigator, MainTabs
  screens/         # Splash, Login, Register, Home, History, AdminHome
  theme/           # tokens + shared styles
  components/      # BrandLockup, AppBottomBar, BalanceCard, History UI…
```

## Mobile phases complete

Phases 1–5 cover auth through certificates and a thin admin console. Full write ops (accounts, bonus, heavy admin) remain on the web app.
