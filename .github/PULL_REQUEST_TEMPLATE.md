## Что и зачем

<!-- Коротко: проблема, пользовательский эффект и почему изменение требуется сейчас. -->

## Scope

- [ ] Изменение ограничено одной понятной задачей/срезом.
- [ ] Не включены случайные refactor/cleanup изменения вне scope.
- [ ] Явно перечислены intentional non-goals / отложенные части.

## Architecture / safety

- [ ] `VlezetDocument` и persistent schema меняются только если это прямо требуется и спроектировано.
- [ ] Миллиметры и domain/geometry authority не заменены Canvas/WebGL/UI state.
- [ ] Semantic Undo/Redo и deterministic validation сохранены.
- [ ] AI/CV не получили authoritative geometry или обход validation.
- [ ] Не добавлены секреты, private source data или несанационированные provider artifacts.
- [ ] Новые GitHub Actions permissions минимальны и обоснованы.

## Verification

<!-- Для behavior change укажите реальное RED -> GREEN evidence. -->

- [ ] Focused tests PASS.
- [ ] `pnpm test` PASS.
- [ ] `pnpm typecheck` PASS.
- [ ] `pnpm lint` PASS.
- [ ] `pnpm build` PASS.
- [ ] Дополнительные browser/benchmark/security gates выполнены, если применимо.

### Evidence

```text
RED:
GREEN:
Exact head:
CI:
Browser / benchmark:
```

## Product / manual acceptance

<!-- Оставьте пустым, если ручная приёмка действительно не нужна. Не заменяйте автоматизируемые проверки ручным чеклистом. -->

- [ ] Не требуется.
- [ ] Требуется и ещё ожидается.
- [ ] Получена и зафиксирована в milestone/focused changelog.

## Documentation

- [ ] README / SECURITY / CONTRIBUTING обновлены, если пользовательский или repository contract изменился.
- [ ] Focused changelog обновлён для milestone work.
- [ ] Canonical `PROJECT_STATE` / `ROADMAP` / `CHANGELOG` не заявляют незавершённую работу как принятую.

## Перед merge

- [ ] PR не Draft.
- [ ] Required checks зелёные на точном head.
- [ ] Нет unresolved review blockers.
- [ ] Merge выполняется только после обязательной product-owner acceptance, если она определена milestone.