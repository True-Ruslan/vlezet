# Vlezet — Content and Terminology

**Phase:** M7.0 Product and UX Audit  
**Language:** Russian user-facing UI  
**Purpose:** one canonical source for product copy and geometry semantics

## 1. Content principles

1. Use ordinary user language first; explain exact geometry where it changes meaning.
2. Do not expose internal enum values, milestone labels or implementation IDs by default.
3. State what is measured, not only the numeric value.
4. Distinguish mandatory validity from preference and recommendation.
5. State whether a result is Draft, Preview or Applied.
6. Buttons use direct verbs and describe the actual next action.
7. Errors include a recovery action when one exists.
8. Optional network/provider wording never implies that core editing requires AI.
9. Avoid false certainty about structure, regulations or real-world properties not present in the document.
10. Keep helper text concise; use progressive explanation instead of permanent paragraphs under every control.

## 2. Canonical glossary

### Длина стены

**Preferred UI wording:** `Длина по оси стены`  
**Meaning:** distance between the semantic endpoints of the wall centre line.  
**Avoid:** `Длина стены` without clarification when clear/internal size may be expected.  
**Short helper:** `Расстояние между узлами по оси стены.`  
**Appears:** wall inspector, wall dimension annotation, documentation.

### Внутренний размер комнаты

**Preferred UI wording:** `Внутренний размер` or section `Чистые внутренние размеры`  
**Meaning:** distance between inner physical wall surfaces for a supported room span.  
**Avoid:** `Размер стены`, `Габарит комнаты` when the exact face semantics matter.  
**Short helper:** `Измеряется между внутренними поверхностями стен.`  
**Appears:** room inspector, dimension annotations, onboarding.

### Площадь по внутреннему контуру

**Preferred UI wording:** `Полезная площадь` with helper `По внутреннему контуру стен`  
**Meaning:** area derived from the usable interior polygon.  
**Avoid:** unexplained `Площадь`, especially beside wall-axis dimensions.  
**Short helper:** `Считается автоматически по внутренним поверхностям стен.`  
**Appears:** room inspector, 3D room inspection, project facts where applicable.

### Толщина стены

**Preferred UI wording:** `Толщина стены`  
**Meaning:** physical wall thickness around its semantic axis.  
**Avoid:** `Ширина стены`.  
**Short helper:** `Выберите, какая физическая грань должна остаться на месте.`  
**Appears:** wall inspector.

### Размер предмета

**Preferred UI wording:** `Ширина`, `Глубина`, `Высота` under section `Размеры предмета`  
**Meaning:** physical oriented object dimensions before rotation.  
**Avoid:** `Габариты` without axis labels; mixing with recommended clearance.  
**Short helper:** `Размеры самого предмета, без зон использования.`  
**Appears:** catalogue, object inspector, 3D inspector.

### Координаты центра

**Preferred UI wording:** `Точное положение центра` in advanced section; fields `X` and `Y`  
**Meaning:** world coordinates of object centre.  
**Avoid:** placing `Центр X/Y` before common object controls without context.  
**Short helper:** `Точное положение центра предмета на плане.`  
**Appears:** advanced object inspector.

### Расстояние между центрами

**Preferred UI wording:** `Расстояние между центрами`  
**Meaning:** Euclidean distance between object centres used by qualitative near/far ranking.  
**Avoid:** generic `Расстояние`, `Зазор`.  
**Short helper:** `Используется только для предпочтения «ближе/дальше».`  
**Appears:** planning preference evidence.

### Минимальный зазор между контурами

**Preferred UI wording:** `Минимальный зазор между контурами`  
**Meaning:** shortest edge-to-edge distance between real rotated object footprints.  
**Compact Canvas label:** `Зазор N мм`  
**Avoid:** `Размер`, `Расстояние между предметами` without contour semantics, `Проход` when no person-clearance norm is implied.  
**Short helper:** `Кратчайшее расстояние между внешними контурами с учётом поворота.`  
**Appears:** planning hard constraint, result evidence, Canvas witness.

### Рекомендуемый зазор

**Preferred UI wording:** `Рекомендуемая зона использования` or section `Рекомендуемые зазоры`  
**Meaning:** user-defined convenience margin around an object; not automatically a legal/normative requirement.  
**Avoid:** `Норматив`, `Обязательный проход` unless authoritative data exists.  
**Short helper:** `Рекомендация для удобства, не строительный норматив.`  
**Appears:** object inspector, fit diagnostics.

### Рекомендация

**Preferred UI wording:** `Рекомендация`  
**Meaning:** product advice that does not invalidate geometry.  
**Avoid:** `Ошибка`, `Ограничение`.  
**State role:** informational/warning, never hard rejection by wording alone.

### Предпочтение

**Preferred UI wording:** `Предпочтение` or compact badge `Желательно`  
**Meaning:** soft planning intent that influences ranking among valid alternatives.  
**Avoid:** `Условие`, `Требование` for soft rules.  
**Short helper:** `Влияет на порядок вариантов, но не запрещает остальные.`

### Обязательное ограничение

**Preferred UI wording:** `Обязательное ограничение` or badge `Обязательно`  
**Meaning:** a violated candidate is rejected.  
**Avoid:** displaying identically to a soft preference.  
**Short helper:** `Варианты, которые нарушают это условие, не показываются.`

### Черновик распознавания

**Preferred UI wording:** `Черновик распознавания`  
**Meaning:** editable geometry candidates derived from reference/CV/AI and not yet part of the apartment.  
**Avoid:** `Распознанный план`, `Готовая квартира` before Apply.  
**Short helper:** `План квартиры не изменится до применения выбранных элементов.`

### Проверяемый черновик пожеланий

**Preferred UI wording:** `Черновик пожеланий` with badge `Нужно проверить`  
**Meaning:** symbolic clauses interpreted from text and awaiting explicit resolution/acknowledgement.  
**Avoid:** `AI-ограничения`, `Автоматическая расстановка`.  
**Short helper:** `Проверьте правила и перенесите их в обычные ограничения.`

### Вариант расстановки

**Preferred UI wording:** `Вариант расстановки`  
**Meaning:** deterministic candidate transforms for selected existing objects.  
**Avoid:** `Дизайн`, `Проект`, `AI-вариант` when generation is deterministic.  
**Short helper:** `Проверенный вариант для выбранных предметов.`

### Предпросмотр

**Preferred UI wording:** `Предпросмотр`  
**Meaning:** temporary non-persistent projection of a proposal.  
**Avoid:** `Применено`, `Сохранено`, `Результат` without state.  
**Short helper:** `Временно показано на плане. Проект ещё не изменён.`

### Применённое изменение

**Preferred UI wording:** action `Применить`, completion `Изменение применено`  
**Meaning:** authoritative document mutation through the accepted Apply/history path.  
**Avoid:** `Сохранить` when the action is applying a generated proposal; autosave is separate.  
**Short helper:** `Изменение попадёт в проект и отменяется одним Undo.`

### Сохранено локально

**Preferred UI wording:** `Сохранено локально`  
**Meaning:** the current project snapshot is stored in this browser.  
**Avoid:** bare `Сохранено` when users may infer cloud/account persistence.  
**Variants:** `Сохраняем…`, `Не сохранено — повторить`.  
**Short helper:** `Проект хранится в этом браузере.`

### Резервная копия проекта

**Preferred UI wording:** `Скачать резервную копию` and `Импортировать резервную копию`  
**Meaning:** portable editable Vlezet project file.  
**Avoid:** making `JSON` the primary user-facing concept. Technical extension may appear secondarily.  
**Short helper:** `Можно импортировать обратно и продолжить редактирование.`

### Подложка

**Preferred UI wording:** `Исходный план` in onboarding/action; `Подложка` as established editor term with helper.  
**Meaning:** calibrated source image/PDF behind structured geometry.  
**Avoid:** `План` alone when it could mean trusted apartment geometry.  
**Short helper:** `Исходное изображение для обводки. Не является геометрией квартиры.`

## 3. Button copy rules

### Creation/tool actions

Use concise nouns where the control selects a persistent tool:

```text
Выбор
Стена
Дверь
Окно
Мебель
Измерить
```

Active-tool status uses a verb/instruction:

```text
Укажите начало стены
Укажите конец стены
Выберите стену для двери
Выберите первую точку
```

### Form and workflow actions

Use exact effect:

```text
Применить размеры
Применить толщину
Сохранить название
Разобрать пожелания
Перенести в ограничения
Найти варианты
Показать предпросмотр
Применить вариант
```

Avoid generic `Готово` unless the effect is already explicit in the workflow title and no data ambiguity exists.

### Destructive actions

Name the entity:

```text
Удалить предмет
Удалить окно
Удалить исходный план
Удалить проект
Удалить черновик
```

Confirmation states consequence and reversibility:

- `Можно отменить через Undo.`
- `Исходный план будет удалён, стены и мебель останутся.`
- `Проект будет удалён из этого браузера. Отменить нельзя.`

## 4. Disabled-state copy

A disabled primary action has nearby reason when the prerequisite is not visually obvious.

Preferred examples:

```text
Выберите от 1 до 3 предметов.
Хотя бы один предмет должен оставаться подвижным.
Сначала загрузите и откалибруйте исходный план.
Разрешите все неоднозначные названия.
Подтвердите неподдержанные части текста.
```

Avoid only reducing opacity with no explanation.

## 5. Error and recovery copy

Structure:

```text
Что не получилось.
Что осталось в безопасности.
Что сделать дальше.
```

Examples:

```text
Не удалось сохранить проект локально. Изменения остаются открыты в редакторе. Повторить сохранение.

Файл исходного плана не найден. Стены и мебель сохранены. Загрузите файл заново или удалите ссылку.

Не удалось разобрать пожелания через OpenRouter. Ручные ограничения доступны ниже. Проверьте ключ или попробуйте другую модель.
```

Avoid blame, raw provider codes as primary text and vague `Произошла ошибка` without recovery.

## 6. Units and number rules

- canonical internal unit: millimetres;
- field unit appears adjacent to value;
- metres are for readable facts when precision permits;
- area uses square metres rounded through canonical formatter;
- `0` is a real exact value where domain allows it;
- empty optional input means no rule and is not converted to zero;
- input accepts decimal comma and period;
- labels state the geometry reference.

Preferred:

```text
3550 мм
3,550 м (fact display only where appropriate)
11,72 м²
Зазор между контурами: 800 мм
Расстояние между центрами: 1240 мм
```

## 7. Status vocabulary

### Fit

```text
Влезает
Влезает, но тесно
Не влезает
```

The current `Влезает вплотную` may remain when evidence shows it is clearer; final wording is browser/user tested.

### Recognition confidence

```text
Высокая уверенность
Нужно проверить
Конфликт
```

Do not show raw `high`, `medium`, `low`, `pending`, `Local + AI` as primary status.

### Workflow state

```text
Черновик
Нужно проверить
Предпросмотр
Применено
Устарело
Не поддержано
```

### Save state

```text
Сохраняем…
Сохранено локально
Не сохранено — повторить
```

## 8. Provider and AI wording

Preferred hierarchy:

1. user goal;
2. optional interpretation/refinement action;
3. external-service disclosure;
4. runtime key/model configuration.

Preferred:

```text
Описать пожелания текстом
Используется OpenRouter только для разбора текста. Расстановку проверяет Vlezet.
Ключ хранится только до закрытия панели.
```

Avoid:

- `Умное` as the only explanation of capability;
- implying that the AI result is authoritative;
- placing provider branding above the manual product task;
- raw model/provider terminology without user benefit.

## 9. Canvas labels

Canvas copy is short and spatially specific:

```text
Внутренний размер 3550 мм
Расстояние 1200 мм
Между центрами 1500 мм
Зазор 800 мм
Предпросмотр
Черновик
Не влезает
```

Long explanations remain in context/help. Labels are viewport-clamped and do not obscure the selected geometry.

## 10. Empty states

Each empty state states:

1. current condition;
2. why it matters;
3. one primary next action.

Examples:

```text
Пока нет комнаты
Замкните контур стен, чтобы Vlezet рассчитал внутренние размеры и площадь.
[Выбрать инструмент «Стена»]
```

```text
В комнате нет предметов
Добавьте мебель, чтобы сравнить варианты расстановки.
[Открыть мебель]
```

## 11. Prohibited production copy

Unless in diagnostics/developer mode, do not show:

- `M6.4`, `M7.x` or other milestone IDs;
- raw UUID fragments;
- raw enum values such as `pending`;
- `Local + AI` without translated meaning;
- implementation package/type names;
- claims of normative compliance without authoritative data;
- claims that a generated proposal is “optimal” when ranking is bounded/deterministic rather than globally optimal.

## 12. Content acceptance

Later implementation slices must verify:

- glossary terms match Canvas, toolbar, inspector and documentation;
- long Russian text does not clip at required viewports/zoom;
- essential semantics do not depend on helper paragraphs alone;
- errors name recovery;
- disabled actions explain unmet prerequisites;
- provider copy preserves manual/local-first authority;
- no internal milestone/enum/ID leaks into ordinary UI.
