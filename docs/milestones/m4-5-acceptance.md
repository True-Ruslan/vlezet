# M4.5 — Assisted Recognition browser acceptance

Цель проверки: подтвердить, что M4.5 безопасно работает как **assisted/experimental recognition**: распознавание может быть неточным, но никогда не подменяет собой точную геометрию Vlezet, не портит существующий проект и не применяется без явного решения пользователя.

> Качество распознавания на реальных планах остаётся известным post-M4.5 quality bug. Оно не является бесконечным merge-blocker, пока соблюдаются safety/lifecycle-инварианты ниже.

## 1. Обязательный merge-gate: startup и lifecycle

1. Запустить ветку `feat/m4-5-assisted-recognition`.
2. Открыть существующий проект и новый проект из JPG/PNG/PDF-плана.
3. Перезагрузить страницу.
4. Вернуться на dashboard и снова открыть проект.

Ожидание:

- редактор открывается без бесконечного `Открываем Vlezet…`;
- optional recognition restore не блокирует основной editor startup;
- ошибка recognition storage не делает основной проект недоступным;
- M0–M4 проект, подложка и обычная геометрия остаются доступными независимо от состояния recognition.

## 2. Обязательный merge-gate: local recognition изолирован от проекта

1. Откалибровать подложку по известному размеру.
2. Открыть `Распознать`.
3. Нажать `Распознать план`.
4. Дождаться review mode либо контролируемого empty/error state.

Ожидание:

- без откалиброванной подложки recognition недоступен;
- локальный анализ не отправляет план во внешнюю AI-службу;
- UI не зависает намертво во время обработки;
- candidates существуют только в `RecognitionDraft`;
- реальные стены/проёмы `VlezetDocument` до явного Apply не меняются;
- пустой или неудачный CV-результат показывает понятный retry/AI/manual-tracing путь;
- ошибка local CV не удаляет существующий draft и не повреждает проект.

Качество и полнота найденных стен здесь оцениваются как diagnostic signal, а не как обязательное условие merge.

## 3. Обязательный merge-gate: review/edit остаётся draft-only

Проверить:

- выбор recognition candidate;
- перетаскивание endpoint-маркеров стены;
- `Принять` и `Отклонить`;
- `Принять уверенные`;
- выбор проёма;
- изменение `Неизвестный → Дверь/Окно`;
- rejected/conflicting candidates визуально отличаются.

Ожидание: все действия меняют только recognition draft. Обычная геометрия квартиры не создаётся и не заменяется до `Применить выбранное`.

## 4. Обязательный merge-gate: persistence и stale protection

### Current-version draft restore

1. Принять несколько candidates и отклонить один.
2. Изменить endpoint стены.
3. Перезагрузить страницу.
4. Снова открыть `Распознать`.

Ожидание: текущий draft, решения пользователя и отредактированные координаты восстановлены.

### Stale session

1. Имея сохранённый draft, заменить исходную подложку или выполнить новую метрическую калибровку.
2. Открыть recognition panel.

Ожидание:

- старый draft явно помечен `stale`;
- применить его к новой reference revision нельзя;
- предлагается удалить draft или распознать заново;
- draft старой версии recognition engine также не восстанавливается как актуальный.

Изменение только opacity/visibility/позиции/поворота подложки не должно само по себе делать session stale.

## 5. Обязательный merge-gate: deterministic apply + Undo/Redo

1. Принять несколько безопасных стен/классифицированных проёмов.
2. Оставить сомнительные элементы pending/rejected.
3. Нажать `Применить выбранное`.

Ожидание:

- создаются обычные структурированные entities Vlezet;
- pending/rejected элементы не применяются;
- `unknown-opening` без классификации не применяется;
- duplicate-existing wall не создаётся повторно;
- вся операция создаёт одну semantic history entry.

Нажать один `Ctrl/Cmd + Z`.

Ожидание: весь применённый batch исчезает одним Undo.

Нажать Redo.

Ожидание: batch возвращается целиком.

После Apply обычная геометрия должна продолжать жить независимо от recognition session.

## 6. Обязательный merge-gate: existing geometry safety

1. Вручную создать несколько стен поверх подложки.
2. Запустить recognition.
3. Найти совпадающие/conflicting candidates.

Ожидание:

- существующие стены не заменяются молча;
- совпадающие стены не дублируются;
- duplicate/conflict диагностируется;
- существующая совпадающая стена может использоваться как host для принятого распознанного проёма;
- команды автоматической замены всей квартиры результатом CV/AI нет.

## 7. Обязательный merge-gate: cloud failure safety

OpenRouter — optional subsystem. Для merge важнее безопасное поведение при успехе, отмене и ошибке, чем качество конкретной модели.

Проверить хотя бы один успешный запрос и сценарии ошибок/отмены:

- неверный API key;
- 402 / недостаточный баланс;
- rate limit;
- несовместимая модель;
- некорректный structured response;
- отмена/закрытие во время запроса.

Ожидание:

- local/current draft не теряется;
- проектная геометрия не меняется;
- controller не остаётся навечно в `AI анализирует…`;
- можно продолжить local review или ручную обводку;
- cloud candidates после успешного ответа остаются reviewable и не auto-apply;
- API key не сохраняется в проекте/IndexedDB/backup.

## 8. Обязательный merge-gate: privacy, backup и lifecycle

### Backup/import

1. Создать recognition draft.
2. Экспортировать `.vlezet.json`.
3. Импортировать backup как новый проект.

Ожидание:

- backup содержит обычный проект и M4 reference raster;
- нет OpenRouter API key, Authorization/Bearer token и image-request secrets;
- незавершённый recognition session не входит в backup;
- импортированный проект не получает чужой recognition draft.

### Duplicate

Дублировать проект с существующим recognition draft.

Ожидание: копируются квартира и независимый reference asset, но незавершённый recognition session не копируется.

### Delete

Удалить проект с recognition draft с dashboard, в том числе после новой загрузки приложения.

Ожидание: проект, asset и recognition session удаляются без влияния на другие проекты.

## 9. Обязательный merge-gate: M0–M4 regression smoke

Убедиться, что после M4.5 по-прежнему работают:

- pan/zoom и `Весь план`;
- стены и T-junctions;
- комнаты/площадь;
- двери/окна;
- мебель, resize/rotate/drag;
- fit statuses;
- autosave/reload;
- JSON import/export;
- PNG с подложкой и без;
- ручной `Начать обводку`.

## 10. Неблокирующая quality-проверка recognition

На том же реальном плане, который выявил RC-дефекты, отдельно зафиксировать качество:

- сколько стен найдено корректно;
- сколько стен смещено/пропущено;
- количество ложных проёмов;
- качество junction/topology reconstruction;
- различия между tested cloud models;
- случаи giant page/crop/bounding-box frame hallucination;
- насколько candidates реально ускоряют ручную обводку.

Ожидание для M4.5: грубые hallucinations и unsafe output должны отфильтровываться, но near-perfect reconstruction **не требуется для merge**.

Не ослаблять deterministic validators ради увеличения recall.

Quality backlog после merge:

1. representative real-plan fixture corpus;
2. measurable recognition metrics;
3. preprocessing/CV tuning against fixtures;
4. better line merging/junction reconstruction;
5. cloud model quality ranking;
6. stronger semantic validation;
7. только затем advanced/custom ML, если метрики это оправдают.

## 11. Final acceptance result

M4.5 можно переводить в Ready for Review и merge, когда обязательный safety/smoke путь проходит без потери данных:

```text
project startup/reload
→ local recognition or controlled failure
→ review/edit
→ optional cloud success/failure
→ explicit deterministic apply
→ one-step Undo/Redo
→ draft reload/stale protection
→ M0–M4 regression smoke
→ exact merge-head strict CI
```

Ключевой инвариант:

> Ни локальный CV, ни внешний AI-ответ никогда не становятся геометрией проекта без явного пользовательского подтверждения и deterministic validation.

Известная неточность/noise recognition фиксируется как post-M4.5 quality bug и сама по себе не блокирует дальнейший roadmap.
