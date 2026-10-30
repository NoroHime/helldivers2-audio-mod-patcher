// Rebuild a bank from a baseline: keep BKHD/DIDX/DATA/HIRC order, keep HIRC verbatim,
// append replacement media to the end of DATA (16B aligned) and rewrite only DIDX rows.
import type { Bank } from './bank';

export interface RebuildResult {
  bytes: Uint8Array;
  replaced: number[];
  appended: number[];
  missing: number[];
  dataBefore: number;
  dataAfter: number;
}

export function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function rebuildBank(base: Bank, replace: Map<number, Uint8Array>, align: number): RebuildResult {
  const pad16 = align > 1 ? align : 1;
  const rows = base.media.map(function (r) { return { id: r.id, off: r.off, size: r.size }; });
  const parts: Uint8Array[] = [base.data.slice()];
  let cursor = base.data.length;
  const replaced: number[] = [];
  const appended: number[] = [];
  const missing: number[] = [];

  for (const pair of Array.from(replace.entries())) {
    const id = pair[0];
    const bytes = pair[1];
    let row = rows.find(function (r) { return r.id === id; });
    const pad = (pad16 - (cursor % pad16)) % pad16;
    if (pad) { parts.push(new Uint8Array(pad)); cursor += pad; }
    if (row) {
      row.off = cursor;
      row.size = bytes.length;
      replaced.push(id);
    } else {
      row = { id: id, off: cursor, size: bytes.length };
      rows.push(row);
      appended.push(id);
    }
    parts.push(bytes);
    cursor += bytes.length;
  }

  const newData = concat(parts);
  const newDidx = new Uint8Array(rows.length * 12);
  const dv = new DataView(newDidx.buffer);
  for (let i = 0; i < rows.length; i++) {
    dv.setUint32(i * 12, rows[i].id, true);
    dv.setUint32(i * 12 + 4, rows[i].off, true);
    dv.setUint32(i * 12 + 8, rows[i].size, true);
  }

  const body: Uint8Array[] = [];
  for (const c of base.chunks) {
    let payload: Uint8Array;
    if (c.tag === 'DIDX') payload = newDidx;
    else if (c.tag === 'DATA') payload = newData;
    else payload = base.bytes.subarray(c.off + 8, c.off + 8 + c.size);
    const head = new Uint8Array(8);
    head[0] = c.tag.charCodeAt(0); head[1] = c.tag.charCodeAt(1);
    head[2] = c.tag.charCodeAt(2); head[3] = c.tag.charCodeAt(3);
    new DataView(head.buffer).setUint32(4, payload.length, true);
    body.push(head);
    body.push(payload);
  }
  const payloadBytes = concat(body);
  const head16 = base.resHead.slice();
  new DataView(head16.buffer).setUint32(4, payloadBytes.length, true);

  return {
    bytes: concat([head16, payloadBytes]),
    replaced,
    appended,
    missing,
    dataBefore: base.data.length,
    dataAfter: newData.length,
  };
}

export function mediaMap(b: Bank): Map<number, Uint8Array> {
  const out = new Map<number, Uint8Array>();
  for (const m of b.media) out.set(m.id, b.data.subarray(m.off, m.off + m.size));
  return out;
}