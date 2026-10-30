// Regression test: rebuild a bank from the baseline and compare with the known-good v3 output.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ROOT = 'D:/ai/HD2研究';
const outdir = mkdtempSync(join(ROOT + '/工具/音频patch修复器', '.selftest-'));
await build({ entryPoints: [ROOT + '/工具/音频patch修复器/src/lib/fix.ts'], bundle: true, format: 'esm', platform: 'node', outfile: outdir + '/fix.mjs', external: [] });
const { fixPackage, extractFromZip } = await import(pathToFileURL(outdir + '/fix.mjs').href);
const sha = (b) => createHash('sha256').update(Buffer.from(b)).digest('hex').slice(0, 16);

const zipBytes = new Uint8Array(readFileSync(ROOT + '/待修复MOD/RS-422 railgun anime girl countdown.zip'));
const bankBytes = new Uint8Array(readFileSync(ROOT + '/_work/bank72_real.bin'));
const v3 = new Uint8Array(readFileSync(ROOT + '/_work/bank72_fixed3.bin'));
const got = extractFromZip(zipBytes);
if (got.error) { console.log('FAIL extract:', got.error); process.exit(1); }
const res = fixPackage(got.patch.bytes, bankBytes, got.patch.name, got.manifest || null, 16, [226190496]);
for (const l of res.report.logs) console.log('  [' + l.level + '] ' + l.text);

const outZip = res.outputs[0];
console.log('output zip bytes:', outZip ? outZip.bytes.length : 'none');
// extract the produced patch and compare its bank payload with bank72_fixed3.bin
const back = extractFromZip(outZip.bytes);
if (back.error) { console.log('FAIL re-extract:', back.error); process.exit(1); }
const produced = back.patch.bytes;
console.log('patch sha:', sha(produced));
const v3PatchZip = new Uint8Array(readFileSync(ROOT + '/待修复MOD/RS-422 railgun anime girl countdown FIXED-26088801-v3.zip'));
const v3Patch = extractFromZip(v3PatchZip).patch.bytes;
console.log('v3    sha:', sha(v3Patch));
console.log('patch identical:', sha(produced) === sha(v3Patch), '| sizes', produced.length, v3Patch.length);
writeFileSync(outdir + '/produced.patch_0', Buffer.from(produced));
console.log('written', outdir + '/produced.patch_0');