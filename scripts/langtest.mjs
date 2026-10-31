// Locale detection cases: any zh-* (incl. zh-tw, zh_HK, zh-Hant) -> zh, else en.
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const APP = 'D:/ai/HD2研究/工具/音频patch修复器';
const out = APP + '/.langtest';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
await build({ entryPoints: [APP + '/src/lib/i18n.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out + '/i18n.mjs' });
const { pickLang, localeToLang } = await import(pathToFileURL(out + '/i18n.mjs').href);

const cases = [
  ['zh-CN', 'zh'], ['zh-TW', 'zh'], ['zh-HK', 'zh'], ['zh-Hant', 'zh'], ['zh_CN', 'zh'],
  ['ZH-cn', 'zh'], ['zh', 'zh'],
  ['en-US', 'en'], ['en', 'en'], ['ja-JP', 'en'], ['de-DE', 'en'], ['', 'en'],
  ['pt-BR', 'en'], ['fr', 'en'], ['ko-KR', 'en'],
];
let bad = 0;
for (const [tag, want] of cases) {
  const got = pickLang({ language: tag, languages: [tag] });
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? ' ok ' : 'FAIL') + '  navigator.language=' + JSON.stringify(tag).padEnd(10) + ' -> ' + got + ' (want ' + want + ')');
}

// saved choice wins over browser
console.log('');
const savedCases = [
  [{ language: 'en-US', saved: 'zh' }, 'zh', 'remembered zh beats en-US'],
  [{ language: 'zh-TW', saved: 'en' }, 'en', 'remembered en beats zh-TW'],
  [{ language: 'en-US', saved: 'garbage' }, 'en', 'bad saved value ignored'],
  [{ language: 'zh-TW', query: 'en' }, 'en', '?lang=en overrides browser'],
  [{ language: 'en-US', query: 'zh-CN' }, 'zh', '?lang=zh-CN overrides browser'],
  [{ languages: ['fr-FR', 'zh-CN'], language: '' }, 'en', 'primary fr wins over secondary zh'],
];
for (const [env, want, label] of savedCases) {
  const got = pickLang(env);
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? ' ok ' : 'FAIL') + '  ' + label.padEnd(38) + ' -> ' + got + ' (want ' + want + ')');
}

rmSync(out, { recursive: true, force: true });
console.log('');
console.log(bad === 0 ? 'ALL PASS (' + (cases.length + savedCases.length) + ' cases)' : bad + ' FAILED');
process.exit(bad === 0 ? 0 : 1);