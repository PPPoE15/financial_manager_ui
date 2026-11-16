# CI → публикация fm-ui

Единственный автоматический путь публикации — job `publish` в
`.github/workflows/ci.yml`. Он зависит от job `build` **этого же запуска**:
`npm ci` → ESLint → проверка типов и сборка → Vitest → публикация.
Проверки и Docker-сборка получают один `github.sha` через явный checkout.
Независимый workflow `docker-image.yml` удалён.

| Событие / результат build | Публикация |
| --- | --- |
| push в dev/master, success | Да |
| push, failure/cancelled/skipped | Нет |
| pull_request, любой результат | Нет |
| Успех другого запуска/SHA | Не разрешает публикацию этого запуска |

PR использует `pull_request`, не `pull_request_target`; job проверки не получает
секреты Docker Hub. Секрет `DOCKERHUB_TOKEN` используется только в job публикации.
Имя пользователя — repository variable `DOCKERHUB_USERNAME` (по умолчанию `pppoe15`).
Не используйте secret для публичного имени: маскирование GitHub может блокировать
передачу job output с именем образа. Прежний secret с именем пользователя не читается. Токен GitHub имеет только `contents: read`, checkout не сохраняет
его в git config.

## Версии и повторный запуск

- Репозиторий Docker Hub: `<vars.DOCKERHUB_USERNAME или pppoe15>/fm-ui`.
- Версия: полный 40-символьный SHA коммита, без сокращений.
- Обе ветки используют финальный stage Dockerfile, одинаковые аргументы и
  платформу `linux/amd64`. Веточных Docker targets нет. Если они появятся,
  нужно добавить target в версию и обновить тесты до публикации таких образов.
- `scripts/publish-image.sh` сначала проверяет SHA-тег. При наличии он повторно
  использует digest, не собирает и не перезаписывает версию. При отсутствии
  собирает и отправляет SHA-тег. Ошибка авторизации/сети останавливает процесс.
- Job сериализован общей concurrency-группой `fm-ui-publication` для обеих веток,
  включая rerun; автоматическая отмена работающей публикации выключена.
  GitHub может заменить ожидающий job более новым; это не очередь всех коммитов.
- Теги `dev` и `master` — изменяемые удобные указатели на последний опубликованный
  этим job образ соответствующей ветки. Повтор старого запуска может вернуть
  указатель к старой версии. Деплой должен использовать **digest**, а не эти теги.
- Защита SHA-тегов от перезаписи действует для этого workflow. Не перезаписывайте
  их вручную/другими publishers и не удаляйте версии, используемые для отката.
  Изменение базового образа для уже опубликованного SHA не пересобирает версию:
  для новой версии нужен новый коммит.

## Контракт для деплоя (FM-66)

Job outputs: `image` (`namespace/fm-ui@sha256:…`), `sha`, `environment`
(`dev` либо `master`). Следующий job может использовать `needs.publish.outputs`.
Те же сведения плюс SHA-тег сохранены в `publication.json`, artifact
`fm-ui-<environment>-<sha>-<run_attempt>`, и в summary запуска. Пример:

```json
{
  "image": "namespace/fm-ui@sha256:<digest>",
  "tag": "namespace/fm-ui:<full-commit-sha>",
  "sha": "<full-commit-sha>",
  "environment": "dev"
}
```

Скачивайте artifact именно нужного успешного запуска и сверяйте SHA/окружение.
Artifact хранится по политике retention репозитория, поэтому долгосрочную запись
развёрнутой версии должен сохранять процесс деплоя. Ошибка загрузки artifact
делает job неуспешным, даже если образ уже опубликован; rerun переиспользует его.

## Проверка

`npm run test -- scripts/__tests__/publish.spec.ts` проверяет реальный YAML и
условие job на матрице success/failure/cancelled/skipped, push/PR и веток.
Тесты исполняют скрипт публикации с подменённой CLI Docker: новый образ для обеих
веток, повторный запуск, ошибки реестра и точный контракт метаданных.
Это локальная симуляция, она не запускает Docker Hub или планировщик GitHub.
Полный набор перед коммитом: `npx eslint .`, `npm run build`, `npm run test`.

После merge первый push в dev проверяет настоящую публикацию: `build` должен
завершиться до старта `publish`, SHA-тег и artifact должны указывать на один digest.
При rerun digest SHA-тега должен сохраниться. Для ручной проверки отказа/отмены
используйте отдельный тестовый репозиторий/реестр: упавшая обязательная проверка
или отмена до завершения `build` должны оставлять `publish` skipped/cancelled.
Не вносите намеренно сломанный код в dev/master ради проверки.

Семантика зависимостей: [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
Чтение digest: [Docker imagetools inspect](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/).
