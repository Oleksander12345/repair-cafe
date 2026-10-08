/**
 * Архітектурні правила Repair Café. Кожне правило відповідає пункту в standards/checks.md
 * і межі модуля зі spec.md. Порушення = помилка (блокує pre-push і `make check`).
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'C-08: циклічні залежності між файлами заборонені.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'module-public-api-only',
      comment:
        'C-09 / spec §1: модуль імпортує інший модуль лише через його index.ts (публічний API).',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'domain-is-pure',
      comment:
        'C-10 / spec §1: domain.ts не залежить від фреймворків, platform чи інфраструктури. Дозволено лише shared/ та node:-модулі.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain\\.ts$' },
      to: {
        pathNot: ['^src/shared/', '^src/modules/[^/]+/domain\\.ts$'],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'modules-not-depend-on-platform',
      comment: 'C-11: модулі не знають про HTTP/платформу; платформа складає модулі, а не навпаки.',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: ['^src/platform/', '^src/app\\.ts$', '^src/server\\.ts$'] },
    },
    {
      name: 'shared-is-leaf',
      comment: 'C-12: shared/ не імпортує модулі, платформу чи конфіг.',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: ['^src/modules/', '^src/platform/', '^src/config/'] },
    },
    {
      name: 'no-orphans',
      comment: 'Файл, який ніхто не імпортує і який нічого не імпортує, — мертвий код.',
      severity: 'error',
      from: { orphan: true, pathNot: ['\\.d\\.ts$'] },
      to: {},
    },
    {
      name: 'not-to-dev-dep',
      comment: 'Продакшн-код не імпортує devDependencies.',
      severity: 'error',
      from: { path: '^src/' },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
