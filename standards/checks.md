# Стандарт: перелік перевірок

Кожна перевірка: **що ловить → де запускається → як блокує**. Повний прогін: `make check`.

| ID   | Перевірка                                 | Інструмент                                       | pre-commit | pre-push | make    |
| ---- | ----------------------------------------- | ------------------------------------------------ | :--------: | :------: | ------- |
| C-01 | Форматування                              | Prettier (`--write` на staged)                   |     ✅     |          | `lint`  |
| C-02 | Лінт: якість коду                         | ESLint + typescript-eslint, 0 warn               |     ✅     |          | `lint`  |
| C-03 | Типи                                      | `tsc --noEmit`, strict                           |     ✅     |          | `check` |
| C-04 | Smoke-тест                                | `node:test`: /health, /version, статуси, навички |            |    ✅    | `test`  |
| C-05 | Збірка                                    | `tsc -p tsconfig.build.json`                     |            |    ✅    | `build` |
| C-06 | Архітектура (R1–R5 зі spec)               | dependency-cruiser                               |            |    ✅    | `deps`  |
| C-07 | `process.env` лише в `src/config`         | ESLint `no-restricted-properties`                |     ✅     |          | `lint`  |
| C-08 | Без циклічних залежностей                 | dependency-cruiser `no-circular`                 |            |    ✅    | `deps`  |
| C-09 | Міжмодульний імпорт лише через `index.ts` | `module-public-api-only`                         |            |    ✅    | `deps`  |
| C-10 | `domain.ts` без фреймворків               | `domain-is-pure`                                 |            |    ✅    | `deps`  |
| C-11 | Модулі не імпортують `platform`           | `modules-not-depend-on-platform`                 |            |    ✅    | `deps`  |
| C-12 | `shared` — листовий шар                   | `shared-is-leaf`                                 |            |    ✅    | `deps`  |
| C-13 | Мертві файли, dev-залежності в src        | `no-orphans`, `not-to-dev-dep`                   |            |    ✅    | `deps`  |

## Чому такий розподіл між hooks

- **pre-commit** — швидкі (секунди), працюють лише по staged-файлах: формат, лінт, типи. Брудний код
  не потрапляє навіть у локальну історію. Доказ: `make hook-demo`.
- **pre-push** — повніші й повільніші: архітектура всього графа, smoke, збірка. Зламаний main не потрапляє на GitHub.
- Hooks — це зручність, а не гарантія (`--no-verify` існує). Тому в Лабі 4 той самий `make check` стане
  обов'язковим кроком CI, і DoD забороняє `--no-verify`.

## Як додати перевірку

1. Додати рядок у таблицю з новим ID. 2. Підключити в `package.json` (`check`) і потрібний hook.
2. Переконатися, що вона _падає_ на навмисно зламаному прикладі — перевірка, яка ніколи не падала, не доведена.
