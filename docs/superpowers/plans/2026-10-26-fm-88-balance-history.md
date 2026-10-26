# FM-88: дневной график остатка

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать критерии PPPoE15/fm-auto-dev#88 и открыть проверенный PR в dev.
**Architecture:** Типизированный API, composable загрузки и валидации, SVG-график с доступными точными значениями. HomeView обновляет отчёт после сохранения операций и стартового остатка.
**Tech Stack:** Vue 3, TypeScript, Tailwind, Vitest; без новых зависимостей.
**Spec:** PPPoE15/fm-auto-dev#88; contracts/transaction.openapi.yaml из fm-auto-dev origin/master; Figma 847:3.

## Global Constraints
- Диапазон включительный, 1–366 дней, 2000–2099, не позже сегодня Europe/Moscow.
- Данные только из points; null разрывает линию, 0 и отрицательные числа известны.
- Макет desktop 847:3; пользователь разрешил остальные состояния и адаптив в стиле проекта.
- Русские docstring всех новых функций, включая тесты.
- TDD, полный CI-набор перед каждым коммитом, PR в dev, свежий review-agent после CI.

## Review Focus
- Граница суток Москвы и високосный год — тесты дат.
- Невалидный диапазон во время запроса — прежний ответ не возвращает график.
- Постоянный остаток, один день и изолированная точка — видимые точки, конечные координаты.
- Частично успешное сохранение стартового остатка — перезагрузка без ожидания имени.
- Сохранение операций при запросе в полёте — действует последний запрос.

### 1. API и загрузка
Files: src/api/balanceHistory.ts, src/types/balanceHistory.ts, src/balanceHistory/{dates,useBalanceHistory}.ts; соответствующие __tests__.
- [ ] Тесты GET-параметров; календаря и включительной длины; смены диапазона, гонок, 409/422/сети.
- [ ] Запустить тесты и подтвердить отсутствие нужного поведения.
- [ ] Реализовать getBalanceHistory(dateFrom, dateTo), validateRange(from,to,today), useBalanceHistory() с reload и состоянием.
- [ ] Проверить тесты.

### 2. График и интеграция
Files: src/components/balanceHistory/{BalanceHistoryCard,BalanceHistoryChart}.vue; HomeView.vue; FirstStepDialog.vue; тесты рядом.
- [ ] Тесты null/0/долга, одного дня и постоянного остатка, состояний, клавиатуры, перезагрузки после сохранения.
- [ ] Запустить тесты и подтвердить ожидаемое падение.
- [ ] SVG с разрывами и точками, даты От/До; точные значения через клавиатуру; существующее окно стартового остатка.
- [ ] Проверить тесты и UI на desktop/360px; сквозной сценарий с API.

### 3. Поставка
- [ ] npx eslint .; npm run build; npm run test.
- [ ] Коммит, push, PR, attach_artifact; дождаться CI.
- [ ] Свежий review-agent; исправления по implement-task; повтор CI/review при необходимости.
- [ ] Обновить PR, issue status:needs-review и ссылку на PR; итог пользователю.
