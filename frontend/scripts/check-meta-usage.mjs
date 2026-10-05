/**
 * F-07 guard: domain display values must come from GET /api/meta (useMeta),
 * never from literals scattered through pages/components.
 *
 * Run: npm run lint:meta --workspace=frontend
 *
 * Each rule bans ONE display-layer literal that was migrated to meta. The
 * allow-list is intentionally narrow:
 * - backend-mirroring zod enums (schemas), TS union types, RBAC role arrays,
 *   route guards, status-transition control flow (`===` checks, cancel gates,
 *   NEXT maps) and free-text availability values are NOT display literals and
 *   are therefore NOT covered by these rules — see docs/AUDIT.md F-07.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..', 'src');

const RULES = [
  {
    id: 'PRIORITY_DOT',
    pattern: /PRIORITY_DOT/,
    allowFiles: [],
    fix: 'use dotColor(group, value) from lib/meta.tsx',
  },
  {
    id: 'TYPE_ICONS',
    pattern: /TYPE_ICONS/,
    allowFiles: [],
    fix: 'use option.icon from useMeta().options(emergencyTypes)',
  },
  {
    id: 'CATEGORY_ARRAY',
    pattern: /\[\s*['"]FOOD['"]\s*,\s*['"]WATER['"]/,
    // admin/Relief.tsx: the zod compile-time mirror (frontend cannot import
    // backend consts — no shared package). The rendered Select is meta-driven.
    allowFiles: ['src/pages/admin/Relief.tsx'],
    fix: "use options('itemCategories') from useMeta()",
  },
  {
    id: 'VERIFY_DECISIONS_ARRAY',
    pattern: /\[\s*['"]VERIFIED['"]\s*,\s*['"]DUPLICATE['"]\s*,\s*['"]REJECTED['"]\s*\]/,
    allowFiles: [],
    fix: "use options('verifyDecisions') from useMeta()",
  },
  {
    id: 'TASK_CHIPS_ARRAY',
    pattern: /\[\s*['"]{0,1}\s*,\s*['"]ASSIGNED['"]\s*,\s*['"]ACCEPTED['"]/,
    allowFiles: [],
    fix: "use options('volunteerTaskStatuses') from useMeta()",
  },
  {
    id: 'PRIORITY_HEX',
    pattern: /#dc2626|#ea580c|#d97706/,
    allowFiles: ['src/lib/meta.tsx'],
    fix: 'priority/status hexes live only in lib/meta.tsx COLOR_HEX',
  },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

let failures = 0;
for (const file of walk(root)) {
  const rel = relative(join(root, '..'), file).replace(/\\/g, '/');
  const text = readFileSync(file, 'utf8');
  for (const rule of RULES) {
    if (rule.allowFiles.includes(rel)) continue;
    const m = text.match(rule.pattern);
    if (m) {
      failures++;
      console.error(`F-07 violation [${rule.id}] in ${rel}: ${rule.fix}`);
    }
  }
}

// Presence check: the meta groups the rules depend on must exist.
const types = readFileSync(join(root, 'lib', 'types.ts'), 'utf8');
for (const g of ['itemCategories', 'verifyDecisions']) {
  if (!types.includes(`'${g}'`)) {
    failures++;
    console.error(`F-07 violation [META_GROUP]: '${g}' missing from lib/types.ts MetaGroup`);
  }
}

if (failures > 0) {
  console.error(`\nlint:meta FAILED with ${failures} violation(s).`);
  process.exit(1);
}
console.log('lint:meta clean — no hardcoded display literals outside the meta layer.');
