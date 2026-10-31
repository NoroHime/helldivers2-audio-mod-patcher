// Orchestrates one repair: unzip -> find patch -> parse -> rebuild against baseline -> rezip.
import { unzipSync, zipSync } from 'fflate';
import { parsePatch, buildPatch } from './patch';
import { parseBank, describeBank } from './bank';
import { rebuildBank, mediaMap } from './bankbuild';

export interface Diag { level: 'ok' | 'warn' | 'err'; key: string; params?: Record<string, string | number> }
export interface FixOutput { name: string; bytes: Uint8Array }
export interface FixReport {
  logs: Diag[];
  outputs: FixOutput[];
  patchName?: string;
  bankBefore?: string;
  bankAfter?: string;
  mediaTotal?: number;
  mediaReplaced?: number;
  mediaMissing?: number;
}

function textLog(r: FixReport, level: Diag['level'], key: string, params?: Record<string, string | number>) {
  r.logs.push({ level, key, params });
}

export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function looksLikePatch(bytes: Uint8Array): boolean {
  if (bytes.length < 72) return false;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return v.getUint32(0, true) === 0xf0000011;
}

export function looksLikeBank(bytes: Uint8Array): boolean {
  if (bytes.length < 32) return false;
  for (let o = 0; o < 64; o++) {
    if (bytes[o] === 0x42 && bytes[o + 1] === 0x4b && bytes[o + 2] === 0x48 && bytes[o + 3] === 0x44) return true;
  }
  return false;
}

export function bankOffset(bytes: Uint8Array): number {
  for (let o = 0; o < 64; o++) {
    if (bytes[o] === 0x42 && bytes[o + 1] === 0x4b && bytes[o + 2] === 0x48 && bytes[o + 3] === 0x44) return o;
  }
  return -1;
}

export function fixPackage(patchBytes: Uint8Array, bankBytes: Uint8Array, patchName: string, manifest: Uint8Array | null, align: number, only?: number[]): { report: FixReport; outputs: FixOutput[] } {
  const report: FixReport = { logs: [], outputs: [] };
  try {
    const patch = parsePatch(patchBytes);
    textLog(report, 'ok', 'log.patch', { n: patch.entries.length, meta: patch.meta.filter(function (b) { return b !== 0; }).length });

    const baseline = parseBank(bankBytes);
    report.bankBefore = describeBank(baseline);
    report.mediaTotal = baseline.media.length;
    if (!baseline.hirc) textLog(report, 'warn', 'log.noHirc');

    // locate the bank entry inside the patch
    let bankEntry = -1;
    for (let i = 0; i < patch.entries.length; i++) {
      if (looksLikeBank(patch.entries[i].data) && patch.entries[i].data.length > 100000) { bankEntry = i; break; }
    }
    if (bankEntry < 0) throw new Error('__err.noBank');
    const modRaw = patch.entries[bankEntry].data;
    const modBank = parseBank(modRaw);
    textLog(report, 'ok', 'log.modBank', { chunks: describeBank(modBank), n: modBank.media.length });

    const baseMedia = mediaMap(baseline);
    const modMedia = mediaMap(modBank);
    const replace = new Map<number, Uint8Array>();
    const skipped: number[] = [];
    for (const pair of Array.from(modMedia.entries())) {
      if (only && only.indexOf(pair[0]) < 0) continue;
      if (baseMedia.has(pair[0])) replace.set(pair[0], pair[1]);
      else skipped.push(pair[0]);
    }
    textLog(report, 'ok', 'log.mediaMatched', { matched: replace.size, skipped: skipped.length });

    if (replace.size === 0) throw new Error('__err.noMatch');
    const rebuilt = rebuildBank(baseline, replace, align);
    report.mediaReplaced = rebuilt.replaced.length;
    report.mediaMissing = rebuilt.missing.length;
    report.bankAfter = describeBank(parseBank(rebuilt.bytes));
    textLog(report, 'ok', 'log.dataSize', { before: rebuilt.dataBefore, after: rebuilt.dataAfter });

    const outPatch = patch.entries.slice();
    outPatch[bankEntry] = {
      fid: outPatch[bankEntry].fid, tid: outPatch[bankEntry].tid,
      off: 0, size: rebuilt.bytes.length,
      ssize: outPatch[bankEntry].ssize, gsize: outPatch[bankEntry].gsize,
      u68: outPatch[bankEntry].u68, u72: outPatch[bankEntry].u72,
      idx: outPatch[bankEntry].idx, data: rebuilt.bytes,
    };
    const built = buildPatch({ meta: patch.meta, types: patch.types, entries: outPatch });
    textLog(report, 'ok', 'log.outputPatch', { n: built.length });

    const files: Record<string, Uint8Array> = {};
    if (manifest) files['manifest.json'] = manifest;
    files[patchName] = built;
    const zipped = zipSync(files, { level: 9, mem: 9 });
    report.patchName = patchName;
    const outName = (patchName.replace(/\.patch_?0?$/, '') || 'patch') + '.fixed.zip';
    report.outputs.push({ name: outName, bytes: zipped });
    textLog(report, 'ok', 'log.zip', { n: zipped.length });
    return { report, outputs: report.outputs };
  } catch (e) {
    const m = String((e as Error).message || e);
    textLog(report, 'err', m.indexOf('__') === 0 ? m : 'log.raw', m.indexOf('__') === 0 ? undefined : { msg: m });
    return { report, outputs: [] };
  }
}

export function extractBankBytes(patchBytes: Uint8Array): Uint8Array | null {
  const p = parsePatch(patchBytes);
  for (const e of p.entries) {
    if (e.data.length > 100000 && looksLikeBank(e.data)) return e.data;
  }
  return null;
}

export function extractFromZip(bytes: Uint8Array): { patch?: { name: string; bytes: Uint8Array }; manifest?: Uint8Array; errorKey?: string; errorMsg?: string } {
  try {
    const files = unzipSync(bytes);
    let patch;
    let manifest;
    for (const name of Object.keys(files)) {
      const lower = name.toLowerCase();
      if (lower.endsWith('.patch_0') || lower.endsWith('.patch')) patch = { name, bytes: files[name] };
      if (lower.endsWith('manifest.json')) manifest = files[name];
    }
    if (!patch) return { errorKey: 'err.zipNoPatch' };
    return { patch, manifest };
  } catch (e) {
    return { errorKey: 'err.zipBroken', errorMsg: String(e) };
  }
}