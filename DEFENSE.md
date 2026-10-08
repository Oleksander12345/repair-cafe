# DEFENSE — Repair Café, лабораторна 1

**Результат.** Модульний каркас HTTP API на TypeScript/Fastify для черги ремонтів.
[Специфікація](spec.md) містить межі модулів, ER-діаграму, сценарії оновлення даних і критерії
прийняття. [Стандарти](standards/) описують формат spec, MADR, Definition of Done і перевірки;
[ADR](adr/) — архітектурні рішення.

**Репозиторій:** [Oleksander12345/repair-cafe](https://github.com/Oleksander12345/repair-cafe).
[Файл для здачі на GitHub](https://github.com/Oleksander12345/repair-cafe/blob/main/DEFENSE.md).
Історія роботи над лабораторною — у гілці `lab1/foundation`.

**Аудит архітектури.** Чорновик відтворено з наданого знімка і фактично перевірено правилами.
[Вивід до виправлень](reports/lab1-audit-before.txt) містить чотири порушення залежностей і дві
помилки ESLint. [Аудит](docs/audit-lab1.md) пояснює топ-3 й окремі коміти: `9b7cb71` (публічний
API модуля), `8dfce71` (спільний `Category` у `shared` та уточнення spec), `69c7ec9` (доменна
помилка замість Fastify-помилки). Окреме виправлення конфігурації — `e9ff957`.

**Перевірка у Windows.** `npm run check` пройшов: Prettier, ESLint, strict TypeScript,
dependency-cruiser (нуль порушень), 5 smoke-тестів і збірка. У Git Bash запущено
`scripts/hook-demo.sh`: pre-commit відхилив помилку ESLint, а `HEAD` не змінився. `make check`
і `make hook-demo` наявні як обгортки, але GNU Make на цьому комп’ютері не встановлений, тому
буквально ці команди не запускались.

Зібраний застосунок також повернув у `/version` поточний короткий Git SHA під час окремої
runtime-перевірки.

**Межі результату.** Це каркас API, а не постійне сховище черги чи транзакційне забезпечення
інваріантів даних; вони визначені у spec як наступний етап. Перші перевірки виконано на Node.js
22.14.0. Заявлений мінімум — 22.22.1 відповідно до вимоги встановленого `lint-staged`.

**Повторна перевірка — 2026-10-09, Node.js 22.22.1.** `npm.cmd ci` завершився без помилок
і вразливостей за `npm audit`. `npm.cmd run check` пройшов: Prettier, ESLint, strict TypeScript,
dependency-cruiser (0 порушень), 5/5 smoke-тестів і збірка. У Git Bash повторно запущено
`scripts/hook-demo.sh`: pre-commit відхилив тестовий файл через дві помилки ESLint, скрипт
завершився повідомленням `OK`, а Git-історія лишилася без змін.
