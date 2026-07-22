# M5 — Spatial 3D browser acceptance

**Status:** PASS — real browser acceptance completed on 2026-07-22.

Цель проверки: подтвердить, что M5 показывает **тот же самый `VlezetDocument` в 3D**, не создаёт второй источник геометрии, не меняет проект при переключении вида и не ломает существующий 2D workflow.

## 1. Startup и изоляция optional 3D

1. Открыть существующий реальный проект с несколькими комнатами, дверями/окнами и мебелью.
2. Перезагрузить страницу в 2D.
3. Переключиться `2D → 3D → 2D` несколько раз.

Ожидание:

- проект всегда сначала доступен в обычном 2D;
- 3D не блокирует startup, autosave или reload;
- если WebGL недоступен/ломается, показывается контролируемое сообщение, а возврат в 2D остаётся возможен;
- переключение вида само по себе не создаёт semantic history entry и не переводит save status в новое сохранение документа.

## 2. Геометрическая эквивалентность стен

На плане с известными размерами сравнить 2D и 3D.

Ожидание:

- количество/расположение стен визуально соответствует 2D;
- направления стен не зеркалятся;
- углы и T-junctions находятся в тех же мировых местах;
- физическая толщина стен соответствует 2D-модели;
- нет систематического смещения, масштабирования или mm→m drift;
- допустимое M5.1 упрощение: wall volumes могут перекрываться в углах/T-junctions; видимых разрывов из-за renderer-specific shortening быть не должно.

Контрольный пример:

```text
2D interval: 3550 mm
3D projected length: exactly the same model length
wall thickness: unchanged
```

## 3. Проёмы

Проверить минимум одну дверь и одно окно на разных стенах.

Ожидание:

- горизонтальная позиция и ширина gap совпадают с 2D;
- проём действительно разрывает wall volume по тому же visible interval contract;
- door/window semantic identity сохраняется;
- текущие вертикальные marker-объекты явно выглядят схематическими и не создают впечатление авторитетной высоты двери/подоконника;
- M5.1 не записывает выдуманные sill/top/door height в проект.

## 4. Полы / комнаты

Проверить простую прямоугольную комнату и проект с несколькими derived rooms.

Ожидание:

- floor geometry совпадает с usable inner room polygons;
- пол не выходит за внутренние грани стен;
- соседние комнаты соответствуют тем же derived room regions, что и 2D;
- не создаются отдельные persistent floor entities.

## 5. Камера и навигация

Проверить:

- Orbit ЛКМ;
- Pan ПКМ;
- колесо / zoom;
- `Перспектива`;
- `Изометрия`;
- `Сверху`;
- toolbar `Весь план` в 3D.

Ожидание:

- каждый preset помещает квартиру в понятный обзор;
- `Сверху` не зеркалит план относительно 2D;
- fit работает на маленьком и обычном квартирном плане;
- zoom/pan/orbit не меняют проектные координаты;
- возврат в 2D не меняет сохранённый 2D viewport из-за движения 3D-камеры.

## 6. 2D ↔ 3D safety contract

До переключения запомнить:

- число стен/проёмов/предметов;
- Undo/Redo доступность;
- выбранную сохранённую геометрию;
- save status.

Выполнить:

```text
2D → 3D → orbit/pan/zoom → 2D
```

Ожидание:

- `VlezetDocument` не изменён;
- past/future semantic history не изменены;
- 3D-инструменты не могут рисовать/перемещать стены;
- 2D editor остаётся той же сессией, а не заново созданным проектом;
- незавершённые transient actions при сознательном входе в read-only 3D безопасно отменяются без изменения уже принятой геометрии.

## 7. Resource lifecycle

Не менее 10 раз переключить `2D ↔ 3D`, меняя camera presets.

Ожидание:

- не появляются несколько наложенных WebGL canvas;
- управление не ускоряется/не дублируется из-за повторных listeners;
- нет заметного последовательного падения производительности;
- renderer, controls, geometries и materials старой 3D-сессии освобождаются при unmount.

После browser acceptance review дополнительно найден и исправлен потенциальный leak `GridHelper` geometry/material. Исправление покрыто отдельным lifecycle dispose test и прошло финальный strict CI.

## 8. M0–M4.6 regression smoke

После 3D-проверки вернуться в 2D и подтвердить:

- pan/zoom/`Весь план`;
- рисование и exact wall editing;
- T-junctions;
- комнаты и площадь;
- clear internal dimensions;
- wall thickness alignment;
- двери/окна;
- dimension lines и `Измерить`;
- мебель/fit statuses;
- Undo/Redo;
- autosave/reload;
- reference import/tracing;
- backup/import/PNG;
- M4.5 recognition остаётся optional и не зависит от 3D.

## 9. Automated gate

Первичный accepted code-bearing HEAD:

```text
bae06971e7969ee8324e540eb9d4a9e758fda1d8
```

GitHub Actions run:

```text
29934171569 — PASS
```

После browser acceptance self-review выявил потенциальный `GridHelper` resource leak. TDD regression cycle:

```text
ea672213f3554d7acf7c604be290718ae37da02f — RED (new disposal test)
a0da8785c8793833c8ff0f66b65a19684f0457a0 — GREEN (cleanup fix)
```

Final code-bearing HEAD GitHub Actions run:

```text
29936603959 — PASS
```

На финальном code-bearing HEAD прошли:

```text
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Все шаги PASS.

Documentation-only acceptance heads также прошли тот же strict gate перед финальным merge decision. Конкретные runs сохранены в PR/Actions history.

## 10. Acceptance result

**PASS — 2026-07-22.**

Реальная браузерная проверка выполнена на пользовательском проекте квартиры.

Подтверждено пользователем и реальным скриншотом:

- 3D-viewer запускается и показывает пространственную проекцию существующего проекта;
- стены/пространственная структура присутствуют в 3D;
- схематические проёмы отображаются;
- доступны `Перспектива`, `Изометрия`, `Сверху`;
- доступны orbit/pan/zoom и `Весь план`;
- переключатель `2D / 3D` присутствует и работает в реальном editor UI;
- заявленный M5.1 функциональный набор присутствует и работает как заявлено.

Пользователь явно подтвердил: **«Все есть»**.

Известные и принятые границы M5.1:

- мебель ещё не проецируется в 3D — это отдельный M5.2 slice;
- door/window vertical geometry остаётся схематической, потому что текущий документ не хранит авторитетные sill/top/door heights;
- прямое редактирование геометрии в 3D намеренно отсутствует;
- photorealism/material assets не входят в M5.1.

Итог:

```text
M5.1 deterministic spatial shell: ACCEPTED
strict CI: PASS
real browser acceptance: PASS
final review lifecycle fix: PASS
ready for merge: YES
```
