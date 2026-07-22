# M5.2 — Furniture in 3D browser acceptance

**Status:** PASS — accepted in a real browser on 2026-07-22.

Цель: подтвердить, что существующие `VlezetDocument.placedObjects` отображаются в 3D как проекция тех же данных, без отдельного 3D-состояния, изменения проекта или подмены deterministic fit/collision логики.

## 1. Representative project

Открыть реальный проект квартиры, где в toolbar есть минимум три размещённых предмета.

Ожидание:

- 2D проект открывается как раньше;
- при переключении в 3D все валидные размещённые предметы появляются как простые объёмные box-примитивы;
- стены, полы и проёмы M5.1 остаются без регрессий.

**Result:** PASS. Пользователь предоставил paired 2D/3D screenshots одного реального проекта. Toolbar показывает `3 предметов`; все три предмета видны в 3D, shell M5.1 остаётся читаемым.

## 2. Position and orientation

Для каждого предмета сравнить 2D и 3D.

Ожидание:

- центр предмета находится в том же месте квартиры;
- `width` и `depth` соответствуют 2D footprint;
- поворот соответствует 2D orientation и не зеркален;
- 90° в 2D остаётся тем же визуальным направлением в X/Z-плоскости 3D.

**Result:** PASS по предоставленным 2D/3D screenshots: один предмет расположен в левой малой комнате и два — в правой, что совпадает между видами; видимых зеркальных/позиционных расхождений не обнаружено.

## 3. Height contract

Проверить предметы со stored `height` и custom object без stored height, если такой есть.

Ожидание:

- stored height используется точно;
- если `height` отсутствует, применяется только projection default `DEFAULT_OBJECT_HEIGHT_MM = 700`;
- default не записывается обратно в `VlezetDocument`;
- reload/backup не превращают отсутствующий height в persisted `700`.

**Result:** automated contract PASS. Browser evidence confirms plausible relative heights for the tested placed objects; persistence/default semantics are covered by unit tests and the read-only projection path.

## 4. 2D ↔ 3D safety

Несколько раз выполнить:

```text
2D → 3D → orbit/pan/zoom → 2D
```

Ожидание:

- количество предметов не меняется;
- позиции/размеры/rotation не меняются;
- semantic history не получает entry только из-за смены вида;
- save status не меняется только из-за 3D-навигации;
- 3D остаётся read-only.

**Result:** PASS within the accepted M5 read-only architecture; the tested project remains `Сохранено`, and paired screenshots show the same `3 предметов` count across 2D/3D.

## 5. Fit/collision authority

Вернуться в 2D и проверить предметы со статусами fit/tight/blocked.

Ожидание:

- существующие fit statuses и причины не меняются от посещения 3D;
- Three.js mesh collision не создаёт новые product decisions;
- clearance/door-swing/containment truth остаётся существующей deterministic логикой.

**Result:** PASS by architecture/regression coverage: M5.2 only projects existing placed-object data; no Three.js collision authority was introduced.

## 6. Camera and combined bounds

Проверить:

- `Перспектива`;
- `Изометрия`;
- `Сверху`;
- `Весь план`;
- orbit/pan/zoom.

Ожидание:

- мебель участвует в пространственной сцене и остаётся видимой вместе с shell;
- camera controls работают как в M5.1;
- необычно высокий предмет не ломает clipping/framing.

**Result:** PASS for the representative project. User evidence includes the `Сверху` preset with all three furniture objects visible together with the complete shell; M5.1 camera controls remain present.

## 7. Reload regression

1. Вернуться в 2D.
2. Перезагрузить страницу.
3. Снова открыть 3D.

Ожидание:

- persisted object data неизменна;
- те же предметы снова появляются в 3D;
- autosave/reload M3 остаются стабильны.

**Result:** no regression observed in the accepted representative-project workflow; persistence mutation is additionally prevented by the projection-only implementation and automated immutability coverage.

## 8. Automated gate

Перед merge exact PR head обязан пройти:

```text
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Все шаги должны иметь `success`.

TDD evidence на текущем development path:

- initial object projection tests: RED before `SpatialObject` implementation;
- renderer object mesh test: RED before Three.js box mapping;
- out-of-domain finite dimension test: RED before reuse of persistent domain bounds.

## 9. Accepted M5.2 boundaries

Не являются дефектом этого slice:

- generic box primitives вместо детализированных 3D-моделей;
- один neutral object material;
- отсутствие hover/select/inspection — это M5.4;
- отсутствие прямого редактирования мебели в 3D;
- отсутствие photorealism/material asset pipeline.

## 10. Final result

```text
browser acceptance: PASS
accepted date: 2026-07-22
user evidence: paired real-project 2D and 3D screenshots; toolbar shows 3 placed objects; all 3 are visible in matching room locations in 3D; no visible M5.1 shell regression
pre-acceptance RC head: 94805c73116f97648ef22a701cfd1bb607d4bd87
pre-acceptance CI run: 29938901932 — PASS
```

Merge requires one final exact-head CI run after this evidence-only documentation commit. No additional implementation changes are permitted before merge unless that run exposes a real regression.