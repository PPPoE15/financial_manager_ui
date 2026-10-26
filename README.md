# financial_manager_ui

Фронтенд «Финансового менеджера»: Vue 3 + TypeScript + Vite, Pinia, Vue Router, Tailwind, Vitest.

## Команды

```sh
npm install         # зависимости
npm run dev         # dev-сервер
npm run build       # проверка типов и сборка в dist/
npm run test        # unit-тесты (Vitest)
npm run lint        # ESLint
npm run format      # Prettier
make build_dev      # Docker-образ pppoe15/fm-ui:dev
```

Переменные окружения: `VITE_API_URL` (API транзакций, по умолчанию `/transaction`),
`VITE_AUTH_API_URL` (API авторизации, по умолчанию `/auth`). Сервисы сами монтируют API под этими
префиксами, поэтому при обращении к бэкенду напрямую префикс входит в адрес:
`VITE_API_URL=http://localhost:8083/transaction`, `VITE_AUTH_API_URL=http://localhost:8082/auth`.

## Публикация Docker-образов

После успешного CI на push в `dev` или `master` публикуется SHA-версия
`pppoe15/fm-ui:<полный SHA>`, затем тег ветки обновляется на её digest без
пересборки. При повторном запуске существующая SHA-версия используется повторно,
а тег ветки обновляется снова. Поэтому `make up_dev` и `make update_front`
в `fm_devops` получают образ через `pppoe15/fm-ui:dev`.

Ошибка обновления тега останавливает публикацию до записи успешных метаданных.
В логе выводятся обновлённый тег и digest; точная ссылка для развёртывания
конкретной версии сохраняется в `publication.json`.
