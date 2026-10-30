// Patch container: u32 magic | u32 typeCount | u32 entryCount | 60B engine metadata
// then type rows and entry rows, then 16B-aligned entry bodies.
import { concat } from './bankbuild';

export const PATCH_MAGIC = 0xf0000011;
const HEADER = 72;
const TYPE_ROW = 32;
const ENTRY_ROW = 80;

export interface PatchEntry {
  fid: bigint; tid: bigint; off: number; size: number;
  ssize: number; gsize: number; u68: number; u72: number; idx: number; data: Uint8Array;
}
export interface PatchType { tid: bigint; count: bigint; al: number; al2: number }
export interface Patch { meta: Uint8Array; types: PatchType[]; entries: PatchEntry[] }

export function parsePatch(bytes: Uint8Array): Patch {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = v.getUint32(0, true);
  if (magic !== PATCH_MAGIC) throw new Error('not an HD2 patch container (magic 0x' + magic.toString(16) + ')');
  const typeCount = v.getUint32(4, true);
  const entryCount = v.getUint32(8, true);
  if (typeCount > 64 || entryCount > 1024) throw new Error('implausible counts: ' + typeCount + '/' + entryCount);
  const meta = bytes.slice(12, 72);
  const types: PatchType[] = [];
  for (let i = 0; i < typeCount; i++) {
    const o = HEADER + i * TYPE_ROW;
    types.push({ tid: v.getBigUint64(o + 8, true), count: v.getBigUint64(o + 16, true), al: v.getUint32(o + 24, true), al2: v.getUint32(o + 28, true) });
  }
  const base = HEADER + typeCount * TYPE_ROW;
  const entries: PatchEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    const o = base + i * ENTRY_ROW;
    const off = Number(v.getBigUint64(o + 16, true));
    const size = v.getUint32(o + 56, true);
    if (off + size > bytes.length) throw new Error('entry ' + i + ' out of bounds');
    entries.push({
      fid: v.getBigUint64(o, true),
      tid: v.getBigUint64(o + 8, true),
      off, size,
      ssize: v.getUint32(o + 60, true),
      gsize: v.getUint32(o + 64, true),
      u68: v.getUint32(o + 68, true),
      u72: v.getUint32(o + 72, true),
      idx: v.getUint32(o + 76, true),
      data: bytes.subarray(off, off + size),
    });
  }
  return { meta, types, entries };
}

export function buildPatch(p: Patch): Uint8Array {
  const headLen = HEADER + p.types.length * TYPE_ROW + p.entries.length * ENTRY_ROW;
  const bodies: Uint8Array[] = [];
  let cursor = headLen;
  const offsets: number[] = [];
  for (const e of p.entries) {
    const pad = (16 - (cursor % 16)) % 16;
    if (pad) { bodies.push(new Uint8Array(pad)); cursor += pad; }
    offsets.push(cursor);
    bodies.push(e.data);
    cursor += e.data.length;
  }
  const head = new Uint8Array(headLen);
  const v = new DataView(head.buffer);
  v.setUint32(0, PATCH_MAGIC, true);
  v.setUint32(4, p.types.length, true);
  v.setUint32(8, p.entries.length, true);
  head.set(p.meta, 12);
  p.types.forEach(function (t, i) {
    const o = HEADER + i * TYPE_ROW;
    v.setBigUint64(o + 8, t.tid, true);
    v.setBigUint64(o + 16, t.count, true);
    v.setUint32(o + 24, t.al, true);
    v.setUint32(o + 28, t.al2, true);
  });
  const base = HEADER + p.types.length * TYPE_ROW;
  p.entries.forEach(function (e, i) {
    const o = base + i * ENTRY_ROW;
    v.setBigUint64(o, e.fid, true);
    v.setBigUint64(o + 8, e.tid, true);
    v.setBigUint64(o + 16, BigInt(offsets[i]), true);
    v.setUint32(o + 56, e.data.length, true);
    v.setUint32(o + 60, e.ssize, true);
    v.setUint32(o + 64, e.gsize, true);
    v.setUint32(o + 68, e.u68, true);
    v.setUint32(o + 72, e.u72, true);
    v.setUint32(o + 76, e.idx, true);
  });
  const body = concat([head, ...bodies]);
  const tail = (16 - (body.length % 16)) % 16;
  if (!tail) return body;
  const padded = new Uint8Array(body.length + tail);
  padded.set(body, 0);
  return padded;
}