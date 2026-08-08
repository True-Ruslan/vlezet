# Vlezet

> Точный local-first планировщик квартиры в реальных миллиметрах — чтобы понять, **влезет ли** мебель, техника и сама идея планировки до покупки и ремонта.

[![CI](https://github.com/True-Ruslan/vlezet/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/True-Ruslan/vlezet/actions/workflows/ci.yml)
[![Browser Acceptance](https://github.com/True-Ruslan/vlezet/actions/workflows/m7-browser-audit.yml/badge.svg?branch=main)](https://github.com/True-Ruslan/vlezet/actions/workflows/m7-browser-audit.yml)
[![Recognition Benchmark](https://github.com/True-Ruslan/vlezet/actions/workflows/recognition-benchmark.yml/badge.svg?branch=main)](https://github.com/True-Ruslan/vlezet/actions/workflows/recognition-benchmark.yml)

**Vlezet** помогает вручную построить или импортировать реальный план квартиры, работать с физическими размерами, расставлять мебель и технику, видеть коллизии и ограничения, а затем экспортировать результат. Интерфейс должен оставаться понятным человеку без опыта работы в CAD.

Проект активно развивается. Точный статус, принятые этапы и текущий приоритет всегда находятся в [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) и [`docs/ROADMAP.md`](docs/ROADMAP.md).

**Автор:** [True-Ruslan](https://github.com/True-Ruslan) · [инженерное портфолио](https://trueruslan.ru/)

## Основные возможности

### Точная 2D-модель квартиры

- стены и связанные вершины в миллиметровой системе координат;
- двери и окна как структурные проёмы известных стен;
- производные комнаты, размеры и полезная площадь;
- сетка, snapping, измерения и семантические Undo/Redo;
- детерминированная геометрия независимо от Canvas-пикселей.

### Мебель и проверка «влезет?»

- предметы с физическими размерами и точными трансформациями;
- столкновения, выход за границы комнаты и блокировка дверей;
- clearance-рекомендации и объяснимые fit-статусы;
- каталог типовых предметов и пользовательские размеры;
- детерминированная проверка перед изменением документа.

### Local-first проекты

- IndexedDB и автоматическое сохранение на устройстве;
- несколько независимых проектов;
- переносимый backup/import в формате `.vlezet.json`;
- PNG-экспорт;
- восстановление после ошибок сохранения;
- работа основных инструментов без аккаунта, облака и сетевой задержки.

### Подложка реального плана

- JPG, PNG и PDF;
- локальная нормализация и хранение исходника;
- калибровка масштаба по известному расстоянию;
- ручная точная обводка поверх изображения;
- безопасная замена/удаление подложки без потери построенной геометрии.

### Assisted recognition

В репозитории есть локальная CV/benchmark-инфраструктура для распознавания планов. Распознавание является **вспомогательным**, а не источником истины: предложения остаются редактируемым Draft, неоднозначность должна завершаться abstain/pending, а обычный документ меняется только через явное применение после детерминированной проверки.

Автоматическое распознавание не является обязательным условием использования основного редактора.

### 3D и планирование

- read-only 3D-проекция той же модели квартиры;
- детерминированные варианты размещения для поддерживаемых сценариев;
- ограничения и Preview остаются временными;
- Apply всегда явный и повторно валидируется.

## Архитектурные гарантии

1. `VlezetDocument` — единственный persistent source of truth квартиры.
2. Миллиметры — каноническая единица; Canvas/WebGL-пиксели не сохраняются как геометрия.
3. `packages/domain`, `packages/geometry` и `packages/editor-core` сохраняют framework-independent authority.
4. Konva и Three.js — только проекции модели.
5. Комнаты, площади, размеры, полы и 3D-сцены являются производными.
6. Изменения документа проходят через семантические команды и Undo/Redo.
7. AI/CV не могут молча создавать authoritative geometry или обходить validation.
8. Существующая геометрия не заменяется и не «чинится» скрытно.
9. Основное редактирование остаётся полностью работоспособным без сети.
10. Неоднозначные операции должны завершаться fail-closed, а не угадывать.

Подробнее: [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md).

## Структура репозитория

```text
apps/web                 Next.js + React UI
packages/domain          document model и migrations
packages/geometry        геометрическая/mathematical authority
packages/editor-core     semantic editing, history, snapping
packages/projects        local-first persistence
packages/recognition     assisted CV и benchmark infrastructure
packages/spatial         renderer-neutral 3D projection
packages/planning        deterministic planning + reviewed intent
tools/                   browser/recognition verification tooling
docs/                    product, architecture, roadmap и acceptance evidence
```

## Локальный запуск

Требования:

- Node.js `>=22.13.0`;
- pnpm `11.15.1`.

```bash
corepack enable
corepack prepare pnpm@11.15.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

После запуска откройте адрес, который напечатает Next.js.

## Проверки качества

Минимальный локальный gate:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Дополнительные проектные проверки:

```bash
pnpm validate:m7-docs
pnpm benchmark:recognition:core
```

GitHub Actions отдельно выполняют основной CI, browser acceptance и recognition benchmark. Merge не должен основываться только на зелёном CI, когда milestone требует продуктовой или визуальной приёмки.

## Безопасность и приватность

- секреты и API-ключи не должны попадать в git, логи, fixtures или evidence artifacts;
- `.env*` игнорируются, кроме явно безопасного `.env.example`;
- исходные пользовательские планы не должны коммититься без явного решения об их публичности;
- optional AI-провайдеры не получают authority над документом;
- сообщения об уязвимостях следует отправлять приватно по правилам [`SECURITY.md`](SECURITY.md).

## Как участвовать

Перед изменениями прочитайте [`CONTRIBUTING.md`](CONTRIBUTING.md). Для PR действует единый checklist из [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).

Главные правила: маленький понятный scope, сохранение архитектурных authority, настоящий RED → GREEN для изменяемого детерминированного поведения и полный regression gate перед merge.

## Документация

Начинать новый контекст рекомендуется в таком порядке:

1. [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — что реально принято и что происходит сейчас;
2. [`docs/ROADMAP.md`](docs/ROADMAP.md) — последовательность развития;
3. [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — каноническая история;
4. [`docs/product/UX_ROADMAP.md`](docs/product/UX_ROADMAP.md) — UX/product sequencing;
5. [`docs/milestones/`](docs/milestones/) — evidence и acceptance records;
6. [`docs/superpowers/specs/`](docs/superpowers/specs/) и [`docs/superpowers/plans/`](docs/superpowers/plans/) — утверждённые designs и implementation plans.

## Стек

- TypeScript;
- Next.js / React;
- Konva / react-konva;
- Three.js;
- Zustand;
- IndexedDB;
- Vitest;
- Playwright (Chromium + representative WebKit coverage);
- pnpm workspaces + Turborepo.

## Статус лицензии

Публичность репозитория сама по себе не предоставляет разрешение на использование кода. Лицензия должна быть выбрана владельцем проекта отдельно; до этого действуют стандартные авторские права.
