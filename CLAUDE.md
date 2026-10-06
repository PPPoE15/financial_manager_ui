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
and `/transaction/` to the backend containers and falls back to `index.html` for SPA routes.
Missing files under `/assets/` return 404 (not `index.html`), so a stale lazy chunk fails cleanly.
Vite `base` must stay `/` (relative base breaks assets on nested-route reloads).

Node: `^22.22.2 || ^24.15.0 || >=26` (jsdom/vitest requirements); the Docker builder uses
`node:22.22.2-alpine`. In `npm run dev` without `VITE_API_URL`/`VITE_AUTH_API_URL`, Vite proxies
`/transaction/` → `localhost:8083` and `/auth/` → `localhost:8082` (the `fm_devops` compose ports),
stripping the prefix like nginx does.

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
- **Router (`src/router/`)**: `createAppRouter(history, guards)`; route names are exported constants
  (`HOME_ROUTE`, `LOGIN_ROUTE`). Global guards are registered from the `guards` array in
  `src/router/guards.ts` — add access checks there. `redirectToLogin(router)` navigates to `login`
  unless already there.
- **Base UI (`src/components/ui/`)**: `BaseInput` (label + input + error, `v-model`; `class`/`style`
  go to the wrapper, other attrs to `<input>`), `BaseButton` (`variant` primary/secondary, `loading`/`disabled`, `type="button"` by
  default), `ErrorMessage` (`role="alert"`, renders nothing for empty message).
- **Views (`src/views/`)**: routed pages; `HomeView`/`LoginView` are placeholders until the screens
  are implemented.
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
