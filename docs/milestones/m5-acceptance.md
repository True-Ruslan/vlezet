# M5 — Spatial 3D browser acceptance

**Status:** pending real browser verification. Automated CI is necessary but is not visual acceptance.

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

## 9. Automated gate before manual acceptance

Точный code/documentation HEAD должен пройти:

```text
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Ожидание: все шаги PASS.

## 10. Acceptance result

До фактической браузерной проверки этот раздел остаётся:

```text
PENDING — real browser acceptance not yet performed
```

PR нельзя переводить в финально accepted/merged только по CI. После ручной проверки отдельно зафиксировать:

- exact tested HEAD;
- CI run;
- что именно проверено визуально;
- найденные дефекты/ограничения;
- итог `PASS` или `FAIL`.
