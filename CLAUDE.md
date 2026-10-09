# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install        # install dependencies
npm run dev        # start Vite dev server with HMR
npm run build      # type-check (vue-tsc --build) then production build to dist/
npm run type-check # vue-tsc --build only
npm run test       # Vitest (jsdom), single run; `npm run test:watch` for watch mode,
                   # `npm run test:coverage` for a v8 coverage report
npm run preview    # preview the production build locally
npm run lint       # eslint . --fix  (CI runs `npx eslint .` without --fix)
npm run format     # prettier --write src/
```

CI (`.github/workflows/ci.yml`): `npm ci` → `npx eslint .` → `npm run build` → `npm run test`.

Docker/deploy:
```sh
make build_dev    # docker build -t pppoe15/fm-ui:dev .
make push_dev     # docker login && docker push pppoe15/fm-ui:dev
```
The Dockerfile does a multi-stage build (`npm run build` → static files served by nginx using
`nginx/nginx.conf`). nginx listens on 443 with certs mounted at `/etc/nginx/ssl`, proxies `/auth/`
and `/transaction/` to the backend containers with the path unchanged (both services mount their API under
their own prefix) and falls back to `index.html` for SPA routes.
Missing files under `/assets/` return 404 (not `index.html`), so a stale lazy chunk fails cleanly.
Vite `base` must stay `/` (relative base breaks assets on nested-route reloads).

Node: `^22.22.2 || ^24.15.0 || >=26` (jsdom/vitest requirements); the Docker builder uses
`node:22.22.2-alpine`. In `npm run dev` without `VITE_API_URL`/`VITE_AUTH_API_URL`, Vite proxies
`/transaction/` → `localhost:8083` and `/auth/` → `localhost:8082` (ports from the fm_devops compose),
keeping the path like nginx does. When pointing the env vars at a backend directly, include the prefix
(`http://localhost:8083/transaction`, `http://localhost:8082/auth`).

## Architecture

Vue 3 + TypeScript + Vite SPA («Финансовый менеджер»), Pinia, Vue Router, Tailwind 3, Vitest +
`@vue/test-utils`. All components use `<script setup lang="ts">`. Path alias `@` → `src/`.

- **HTTP (`src/api/`)**: `http.ts` — `createHttpClient({ getToken, onUnauthorized })`, one axios
  instance for both backends. Base URL is chosen per request by the custom `api` config field:
  `'transaction'` (default, `VITE_API_URL`, fallback `/transaction`) or `'auth'`
  (`VITE_AUTH_API_URL`, fallback `/auth`), e.g. `http.post('/token', body, { api: 'auth' })`.
  Adds `Authorization: Bearer <token>`; a 401 on a request that carried a token calls
  `onUnauthorized`. Requests made without a session (login, registration) pass `skipAuth: true`:
  no token is attached even if a stale one is stored, and their 401 (wrong credentials) is left to
  the caller. `client.ts` exports the app-wide `http` wired to the session store: a 401 clears the
  session and calls the handler set via `setSessionExpiredHandler` — `main.ts` sets it to
  `redirectToLogin(router)`. `src/api/` must not import the router (guards in `src/router/guards.ts`
  may call the API, which would create an import cycle). API functions should import `http` from
  `@/api/client`.
- **Session (`src/stores/session.ts`)**: Pinia setup store — `token` (persisted in `localStorage`
  under `authToken`; if storage access throws, the session stays in memory only), `user` (`User` from `GET /auth/me`), `isAuthenticated`, `setToken`, `setUser`,
  `clear`.
- **Router (`src/router/`)**: `createAppRouter(history, guards)`; route names are constants in
  `src/router/names.ts` (`HOME_ROUTE`, `LOGIN_ROUTE`, `REGISTER_ROUTE`), re-exported from
  `@/router` — guards import them from `names.ts` to avoid an import cycle. Global guards are
  registered from the `guards` array in `src/router/guards.ts` — add access checks there.
  `guestOnlyGuard` sends an authenticated user away from routes with `meta.guestOnly` (login,
  registration) to home. `authGuard` protects every other route: without a token → `login` with
  `?redirect=<fullPath>` (`useSignIn` returns there after login, only for in-app paths); with a token
  and no loaded user it calls `GET /auth/me` (`getCurrentUser`) — a 401 clears the session and the
  navigation goes to `login`, other errors let it through without a user. Protected routes are
  children of the `/` route rendered inside `AppLayout`. `redirectToLogin(router)` navigates to
  `login` unless already there.
- **Base UI (`src/components/ui/`)**: `BaseInput` (label + input + error, `v-model`; `class`/`style`
  go to the wrapper, other attrs to `<input>`), `BaseButton` (`variant` primary/secondary, `loading`/`disabled`, `type="button"` by
  default), `ErrorMessage` (`role="alert"`, renders nothing for empty message).
- **Auth (`src/auth/`, `src/api/auth.ts`, `src/components/auth/`)**: `api/auth.ts` — `login`
  (`POST /auth/token`) and `register` (`POST /auth/registration`), both with `skipAuth`.
  `auth/validation.ts` — client-side checks mirroring `contracts/auth.openapi.yaml`;
  `auth/errors.ts` — `mapAuthError` turns a backend error into a form-level `message` and/or
  per-field `fields` (422 messages from pydantic are English, so field texts are our own);
  `auth/useSignIn.ts` — login → `session.setToken` → `redirect` from the query (in-app paths only) or home. `LoginForm`/`RegistrationForm` share
  `AuthFormLayout` (form-level error above the submit button, `novalidate`, button `loading` while
  the request is in flight — repeated submits are ignored). Registration signs in right after.
- **Views (`src/views/`)**: routed pages. `LoginView` serves both `/login` and `/register` (mode
  from the route name, tabs are `RouterLink`s) per Figma Frame 6/7; below `lg` the green panel is
  hidden and a compact logo (same SVG, recoloured via CSS mask) sits above the form. `HomeView` is
  the «Обзор» screen: greeting «Добрый день, <name>» and the budget-structure card (other Frame 8
  cards come with FM-2+).
- **Budget structure (`src/budget/`, `src/api/budget.ts`, `src/components/budget/`)**:
  `getBudgetStructure(year, categoryType)` → `GET /transaction/budget-structure`.
  `useBudgetStructure` holds `year` (default current, clamped to 2000–2099) and `categoryType`
  (default `outcome`), refetches on change and drops responses/errors of superseded requests.
  `BudgetStructureCard` (header, «Расходы / Доходы» toggle, year arrows, loading / error with
  «Повторить» / empty states — none of these are in the mockup, agreed in FM-28) wraps
  `BudgetStructureTable`: horizontally scrolled inside the card, «Категория» sticky; column widths
  in `columns.ts`. `null` amounts render as a pale «—» with an sr-only reason (план не задан /
  нет завершённых месяцев / месяц ещё не наступил), `0` as «0 ₽». The plan/fact colouring from the
  mockup is not implemented yet (TODO in the table).
- **Money (`src/utils/money.ts`)**: `formatMoney(value)` — app-wide ₽ formatter for integer roubles:
  `10 000 ₽` with NBSP grouping (also for 4-digit numbers, unlike `Intl` ru-RU), `−` for negatives,
  `null` → `MISSING_VALUE` («—»).
- **Shell (`src/components/layout/AppLayout.vue`)**: Figma Frame 8 sidebar — logo, menu (only
  «Обзор» so far), user block (initial instead of the mockup's photo — the API has no avatar) and
  the «Выход» button (`auth/useSignOut.ts`: clears the session → `login`). No narrow mockup: below
  `lg` the sidebar becomes a top bar without the menu.
- Tests live next to code in `__tests__/*.spec.ts` (type-checked via `tsconfig.vitest.json`).

## Styling

Layout comes from the Figma file `FAPPJ3LrAUEY8indrAbfnV`, section «Финансовый менеджер. Разработка»
(node `136:10`). The Tailwind theme (`tailwind.config.js`) carries its tokens — colors (`primary`,
`surface`, `ink`, `sidebar`, `success`/`warning`/`danger`), fonts (`font-sans` = Onest,
`font-brand` = Manrope, self-hosted via `@fontsource`), font sizes with the mockup's letter-spacing,
radii (`rounded` = 10px, `rounded-md` = 8px, `rounded-sm` = 5px), `h-control` = 50px. Use these
tokens and Tailwind utilities, not hardcoded hex values or scoped CSS.

## UI language

User-facing strings (labels, buttons, messages) are in Russian; keep new text consistent with this.
