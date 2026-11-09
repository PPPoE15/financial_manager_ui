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

## SSH deployment (FM-66)

После успешной публикации workflow передаёт digest серверному контроллеру fm_devops
через SSH. Push в dev/master использует соответствующий GitHub Environment.
Master требует required reviewer в настройках окружения.
Подготовка SSH, environment secrets и процедура восстановления:
[fm_devops deployment guide](https://github.com/PPPoE15/fm_devops/blob/dev/docs/deployment.md).
На сервере должен быть установлен контроллер FM-66 и выполнен bootstrap.
Повторять неудачный деплой через Re-run failed jobs, сохраняя digest успешной публикации.
Клиент `scripts/deploy-ssh.py` выводит проверку входных данных, SSH-этап, digest и время
операции. При отказе он показывает безопасное описание ошибки подключения или
ответа контроллера. Если контроллер указал журнал, прочитайте его на сервере
в `DEPLOY_ROOT/logs`. Итог и применённые digest доступны в Job Summary.

Проверка клиента: `python3 -m unittest discover -s scripts/tests -p test_deploy_ssh.py -v`.

## Публикация Docker-образов

После успешного CI на push в `dev` или `master` публикуется SHA-версия
`pppoe15/fm-ui:<полный SHA>`, затем тег ветки обновляется на её digest без
пересборки. При повторном запуске существующая SHA-версия используется повторно,
а тег ветки обновляется снова. Поэтому `make up_dev` и `make update_front`
в `fm_devops` получают образ через `pppoe15/fm-ui:dev`.

Ошибка обновления тега останавливает публикацию до записи успешных метаданных.
В логе выводятся обновлённый тег и digest; точная ссылка для развёртывания
конкретной версии сохраняется в `publication.json`.
