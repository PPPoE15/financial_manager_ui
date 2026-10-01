# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install       # install dependencies
npm run dev       # start Vite dev server with HMR
npm run build     # type-check (vue-tsc --build) then production build to dist/
npm run type-check # vue-tsc --build only
npm run preview   # preview the production build locally
npm run lint      # eslint . --fix
npm run format    # prettier --write src/
```

There is no test runner configured in this project (no test script, no test files).

Docker/deploy:
```sh
make build_dev    # docker build -t pppoe15/fm-ui:dev .
make push_dev      # docker login && docker push pppoe15/fm-ui:dev
```
The Dockerfile does a multi-stage build (`npm run build` → static files served by nginx using `nginx/nginx.conf`).

## Architecture

This is a Vue 3 + TypeScript + Vite SPA (financial manager / "Финансовый менеджер") for tracking income/outcome transactions against user-defined categories, talking to a separate backend over two API roots.

**API layer (`src/api/`)**: thin axios wrapper functions, one file per endpoint (`login.ts`, `registration.ts`, `get_transactions.ts`, `create_transactions.ts`, `get_categories.ts`). Base URLs come from `src/api/constants.ts`:
- `TRANSACTION_API_URL` — `VITE_API_URL` env var, defaults to `/transaction`
- `AUTH_API_URL` — `VITE_AUTH_API_URL` env var, defaults to `/auth`

Auth is a bearer JWT stored in `localStorage` under `authToken`, set by `loginUser()` in `login.ts` and manually attached as an `Authorization: Bearer ...` header in every authenticated request (no shared axios instance/interceptor exists yet — each API function repeats this header).

**Routing (`src/router/index.ts`)**: flat route table, no nested routes or route guards yet:
- `/` → `HomePage` (login/registration tabs)
- `/registration` → `RegistrationView`
- `/transaction-list` → `TransactionsTabsView` (income/outcome tabs)
- `/add-transaction` → `AddTransactionView`

**View/component split**: `src/views/` holds routed page components; `src/components/` holds reusable pieces and some component-level "tabs" containers (`HomePage.vue` and `TransactionsTabsView.vue` both implement the same hand-rolled tab-switcher pattern via a local `activeTab` data property — follow that existing pattern if adding another tabbed view rather than introducing a new abstraction).

**Mixed component style**: the codebase mixes Vue Options API (`<script lang="ts">` + `export default {...}`) and Composition API (`<script setup lang="ts">`) across sibling files with no consistent rule — check the file you're editing and match its existing style rather than converting it.

**Data flow for transactions**: `TransactionsTabsView` → `TransactionsView` (fetches via `getTransactions`, `<script setup>` top-level `await`) → `TransactionTable` (generic column-driven table, also handles the "add new row" form using `DropDownList` for category selection and `createTransaction`). Table column definitions are plain `{ label, prop, type }` objects passed as props, not derived from the data type.

**Known inconsistencies to be aware of** (don't silently "fix" these as drive-by changes unless asked):
- `src/components/AddTransaction copy.vue` is a stale duplicate/leftover of `AddTransaction.vue` with divergent, non-functional code (calls `fetch()` against a placeholder URL) — likely dead code, not wired into the router.
- `src/components/AddTransaction.vue` also uses a placeholder `fetch('https://your-api-url/transactions', ...)` instead of the real `src/api/create_transactions.ts` helper used elsewhere.
- Transaction type values are inconsistent between `income`/`outcome` (used in `src/types/transaction.ts`, API calls, tabs) and `income`/`expense` (used in `AddTransaction.vue`'s select options).
- Path alias `@` → `src/` is configured in both `vite.config.ts` and `tsconfig`; use it for imports instead of relative paths (existing code does this consistently).

## Styling

Tailwind CSS is configured (`tailwind.config.js`, `postcss.config.js`) but much of the UI still uses scoped `<style>` blocks with hardcoded hex colors (`#d4d1fe`, `#583f9b`, `#35354f`) rather than Tailwind utility classes — both approaches currently coexist.

## UI language

User-facing strings (labels, buttons, alerts) are in Russian; keep new user-facing text consistent with this.
