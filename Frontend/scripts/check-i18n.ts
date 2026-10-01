/**
 * Checks the screen texts (src/locales/<lang>/*.json):
 *   1. every language has every key of Vietnamese (missing keys fail; extra keys are listed);
 *   2. every key used with t('...') / translate('...') exists;
 *   3. Vietnamese text still typed into the screens in scope (shared parts and Settings).
 *
 *   npm run check-i18n            # 1 and 2 fail the run, 3 is a report
 *   npm run check-i18n -- --strict  # 3 fails too (once the screens in scope are converted)
 *   npm run check-i18n -- --list    # also prints every line found by 3
 *
 * A line that must stay Vietnamese (e.g. the name "Tiếng Việt" of the language itself) ends with // i18n-ignore.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const LOCALES = join(SRC, 'locales');
const DEFAULT = 'vi';

/** Screens translated now: shared parts and Settings (Inventory and the other modules come later). */
const SCOPE = [
  'App.tsx', 'components/common', 'components/layout', 'context', 'hooks', 'services', 'utils',
  'modules/auth', 'modules/account', 'modules/settings'
];

/** In the folders above but not screen texts of the scope: mock data of other modules, unused controls. */
const EXCLUDE = [
  'services/resourceBookingService.ts',          // HR resource booking mock data
  'services/api.ts',                             // inventory mock API
  'services/i18nDbService.ts',                   // old localStorage translations, replaced by phase B
  'components/common/CategoryViewTemplate.tsx',  // not used by any screen
  'components/common/MultiCodeSearch.tsx'        // not used by any screen
];

const strict = process.argv.includes('--strict');
const list = process.argv.includes('--list');

type Texts = Record<string, unknown>;

const flatten = (texts: Texts, prefix = ''): string[] =>
  Object.entries(texts).flatMap(([key, value]) =>
    value && typeof value === 'object' ? flatten(value as Texts, `${prefix}${key}.`) : [`${prefix}${key}`]);

const readLanguage = (code: string): Set<string> => {
  const keys = readdirSync(join(LOCALES, code)).filter(f => f.endsWith('.json'))
    .flatMap(f => flatten(JSON.parse(readFileSync(join(LOCALES, code, f), 'utf8'))));
  return new Set(keys);
};

const files = (path: string): string[] => {
  const full = join(SRC, path);
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full).flatMap(name => files(join(path, name)));
};

let failed = false;

// 1. Same keys in every language.
const languages = readdirSync(LOCALES).filter(name => statSync(join(LOCALES, name)).isDirectory());
const reference = readLanguage(DEFAULT);
for (const code of languages.filter(c => c !== DEFAULT)) {
  const keys = readLanguage(code);
  const missing = [...reference].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !reference.has(k));
  if (missing.length > 0) {
    failed = true;
    console.error(`THIẾU [${code}] ${missing.length} khóa: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ' ...' : ''}`);
  }
  if (extra.length > 0) console.warn(`Thừa [${code}] ${extra.length} khóa (không có trong tiếng Việt): ${extra.join(', ')}`);
}

// 2. Keys used in the code exist.
const allSources = files('.').filter(f => /\.(tsx?|jsx?)$/.test(f));
const used = new Map<string, string>();
for (const file of allSources) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\b(?:t|translate)\(\s*['"`]([a-zA-Z][\w]*(?:\.[\w]+)+)['"`]/g)) {
    if (!used.has(match[1])) used.set(match[1], relative(SRC, file));
  }
}
const unknown = [...used].filter(([key]) => !reference.has(key));
if (unknown.length > 0) {
  failed = true;
  unknown.forEach(([key, file]) => console.error(`KHÔNG CÓ KHÓA ${key} (dùng ở ${file})`));
}

// 3. Vietnamese typed into the screens in scope.
const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const stripComments = (code: string) => code
  .replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, ' '))   // keep line numbers
  .split('\n').map(line => line.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');

const report: { file: string; lines: { number: number; text: string }[] }[] = [];
for (const file of SCOPE.flatMap(files).filter(f => /\.(tsx?|jsx?)$/.test(f)
    && !EXCLUDE.includes(relative(SRC, f).replace(/\\/g, '/')))) {
  // CRLF files: a trailing \r would stop the comment pattern from matching.
  const raw = readFileSync(file, 'utf8').split(/\r?\n/);
  const code = stripComments(raw.join('\n')).split('\n');
  const lines = code
    .map((line, index) => ({ number: index + 1, line, original: raw[index] }))
    .filter(x => VIETNAMESE.test(x.line) && !x.original.includes('i18n-ignore'))
    .map(x => ({ number: x.number, text: x.original.trim().slice(0, 140) }));
  if (lines.length > 0) report.push({ file: relative(SRC, file).replace(/\\/g, '/'), lines });
}
report.sort((a, b) => b.lines.length - a.lines.length);
const total = report.reduce((sum, r) => sum + r.lines.length, 0);
console.log(`\nChuỗi tiếng Việt còn gõ cứng (phần dùng chung + Cài đặt): ${total} dòng trong ${report.length} file`);
for (const r of report) {
  console.log(`  ${String(r.lines.length).padStart(4)}  ${r.file}`);
  if (list) r.lines.forEach(l => console.log(`          ${l.number}: ${l.text}`));
}
if (strict && total > 0) failed = true;

console.log(`\nNgôn ngữ: ${languages.join(', ')} · ${reference.size} khóa · ${used.size} khóa được dùng trong code`);
process.exit(failed ? 1 : 0);
