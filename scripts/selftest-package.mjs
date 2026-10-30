// Extra check: a known-good mod package can serve as the baseline source.
import { build } from 'esbuild';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ROOT = 'D:/ai/HD2研究';
const APP = ROOT + '/工具/音频patch修复器';
const outdir = APP + '/.selftest-pkg';
rmSync(outdir, { recursive: true, force: true });
await build({ entryPoints: [APP + '/src/lib/fix.ts'], bundle: true, format: 'esm', platform: 'node', outfile: outdir + '/fix.mjs' });
const { extractFromZip, extractBankBytes, fixPackage } = await import(pathToFileURL(outdir + '/fix.mjs').href);
const sha = (b) => createHash('sha256').update(Buffer.from(b)).digest('hex').slice(0, 16);

const good = new Uint8Array(readFileSync(ROOT + '/待修复MOD/RS-422 railgun anime girl countdown FIXED-26088801-v3.zip'));
const old = new Uint8Array(readFileSync(ROOT + '/待修复MOD/RS-422 railgun anime girl countdown.zip'));
const bankFromPkg = extractBankBytes(extractFromZip(good).patch.bytes);
console.log('baseline extracted from package:', bankFromPkg ? bankFromPkg.length + ' bytes' : 'none');
const res = fixPackage(extractFromZip(old).patch.bytes, bankFromPkg, '9ba626afa44a3aa3.patch_0', extractFromZip(old).manifest || null, 16, [226190496]);
for (const l of res.report.logs) console.log('  [' + l.level + '] ' + l.text);
const back = extractFromZip(res.outputs[0].bytes);
console.log('output patch sha:', sha(back.patch.bytes), '| reference:', sha(extractFromZip(good).patch.bytes));
rmSync(outdir, { recursive: true, force: true });