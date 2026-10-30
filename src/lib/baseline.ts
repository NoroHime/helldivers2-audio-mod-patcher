// Baseline bank fetch + integrity check. The bank is the current build's original
// Wwise sound bank; we never modify it, we only use its structure and untouched media.
export const BASELINE = {
  build: '26088801',
  bytes: 4495534,
  sha256: '',            // filled in when the asset is published
  url: 'https://github.com/NoroHime/helldivers2-audio-mod-patcher/releases/download/bank-26088801/bank-26088801.bin',
};

export interface FetchProgress { loaded: number; total: number }

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', ab);
  return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

export async function fetchBaseline(onProgress: (p: FetchProgress) => void): Promise<{ bytes: Uint8Array; sha: string }> {
  const res = await fetch(BASELINE.url);
  if (!res.ok) throw new Error('下载失败：HTTP ' + res.status + '（Release 资产可能还没发布）');
  const total = Number(res.headers.get('content-length') || BASELINE.bytes);
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    loaded += step.value.length;
    onProgress({ loaded: loaded, total: total });
  }
  let n = 0;
  for (const c of chunks) n += c.length;
  const bytes = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { bytes.set(c, o); o += c.length; }
  if (BASELINE.bytes && bytes.length !== BASELINE.bytes) {
    throw new Error('大小不符：期望 ' + BASELINE.bytes + ' 字节，实际 ' + bytes.length);
  }
  const sha = await sha256Hex(bytes);
  if (BASELINE.sha256 && sha !== BASELINE.sha256) throw new Error('校验和不符，拒绝使用该文件：' + sha.slice(0, 16));
  return { bytes: bytes, sha: sha };
}