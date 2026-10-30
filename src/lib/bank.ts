// Wwise bank parsing. Layout:
//   [16B resource header: 8B tag/hash | u32 payloadLen | u32 label] | BKHD | DIDX | DATA | HIRC ...
// Chunks are packed back to back, no padding between them.

export interface Chunk { tag: string; off: number; size: number }
export interface MediaRow { id: number; off: number; size: number }
export interface Bank {
  bytes: Uint8Array;
  resHead: Uint8Array;
  chunks: Chunk[];
  media: MediaRow[];
  data: Uint8Array;
  hirc: Uint8Array | null;
}

function findBkhd(bytes: Uint8Array): number {
  for (let o = 0; o + 4 <= bytes.length && o < 256; o++) {
    if (bytes[o] === 0x42 && bytes[o + 1] === 0x4b && bytes[o + 2] === 0x48 && bytes[o + 3] === 0x44) return o;
  }
  return -1;
}


function view(b: Uint8Array): DataView { return new DataView(b.buffer, b.byteOffset, b.byteLength); }

export function parseBank(bytes: Uint8Array): Bank {
  const start = findBkhd(bytes);
  if (start < 0) throw new Error('no BKHD chunk found');
  const v = view(bytes);
  const chunks: Chunk[] = [];
  let off = start;
  while (off + 8 <= bytes.length) {
    const tag = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    if (tag.charCodeAt(0) < 65 || tag.charCodeAt(0) > 90) break;
    const size = v.getUint32(off + 4, true);
    if (off + 8 + size > bytes.length) break;
    chunks.push({ tag, off, size });
    off += 8 + size;
  }
  const pick = (t: string) => chunks.find(c => c.tag === t);
  const didx = pick('DIDX');
  const data = pick('DATA');
  const hirc = pick('HIRC');
  if (!didx || !data) throw new Error('bank is missing DIDX or DATA');
  const media: MediaRow[] = [];
  const rows = didx.size / 12;
  for (let i = 0; i < rows; i++) {
    const o = didx.off + 8 + i * 12;
    media.push({ id: v.getUint32(o, true), off: v.getUint32(o + 4, true), size: v.getUint32(o + 8, true) });
  }
  return {
    bytes,
    resHead: bytes.slice(0, start),
    chunks,
    media,
    data: bytes.subarray(data.off + 8, data.off + 8 + data.size),
    hirc: hirc ? bytes.subarray(hirc.off + 8, hirc.off + 8 + hirc.size) : null,
  };
}

export function describeBank(b: Bank): string {
  return b.chunks.map(function (c) { return c.tag + '(' + c.size + ')'; }).join(' / ');
}