import { useCallback, useEffect, useMemo, useState } from 'react';
import { fixPackage, extractFromZip, extractBankBytes, looksLikeZip, looksLikePatch, looksLikeBank, type FixReport } from './lib/fix';
import { putBank, getBank, clearBank } from './lib/storage';
import { BASELINE, fetchBaseline } from './lib/baseline';

type Out = { name: string; bytes: Uint8Array };

function download(name: string, bytes: Uint8Array) {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const url = URL.createObjectURL(new Blob([ab], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

async function readFile(f: File): Promise<Uint8Array> {
  const buf = await f.arrayBuffer();
  return new Uint8Array(buf);
}

export default function App() {
  const [patchFile, setPatchFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [manifest, setManifest] = useState<Uint8Array | null>(null);
  const [bankFile, setBankFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [report, setReport] = useState<FixReport | null>(null);
  const [outputs, setOutputs] = useState<Out[]>([]);
  const [busy, setBusy] = useState(false);
  const [align, setAlign] = useState(16);
  const [cached, setCached] = useState<{ name: string; kb: number } | null>(null);
  const [fetching, setFetching] = useState(0);
  const [fetchErr, setFetchErr] = useState('');

  const onPatch = useCallback(async (f: File) => {
    const bytes = await readFile(f);
    if (looksLikeZip(bytes)) {
      const got = extractFromZip(bytes);
      if (got.error || !got.patch) { setReport({ logs: [{ level: 'err', text: got.error || 'no patch inside' }], outputs: [] }); return; }
      setPatchFile(got.patch);
      setManifest(got.manifest || null);
      setReport({ logs: [{ level: 'ok', text: 'zip 解包成功：' + got.patch.name }], outputs: [] });
    } else if (looksLikePatch(bytes)) {
      setPatchFile({ name: f.name, bytes });
      setManifest(null);
      setReport({ logs: [{ level: 'ok', text: '直接读取 patch：' + f.name }], outputs: [] });
    } else {
      setReport({ logs: [{ level: 'err', text: '拖入的不是 zip 也不是 patch' }], outputs: [] });
    }
    setOutputs([]);
  }, []);

  const onBank = useCallback(async (f: File) => {
    let bytes = await readFile(f);
    let fromPkg = '';
    if (!looksLikeBank(bytes)) {
      // accept a known-good audio mod (zip or patch): its patch carries a full current-build bank
      try {
        let patchBytes: Uint8Array | null = null;
        if (looksLikeZip(bytes)) {
          const got = extractFromZip(bytes);
          if (got.patch) patchBytes = got.patch.bytes;
        } else if (looksLikePatch(bytes)) patchBytes = bytes;
        if (patchBytes) {
          const bank = extractBankBytes(patchBytes);
          if (bank) { bytes = bank; fromPkg = '（从 ' + f.name + ' 里的 bank 条目提取）'; }
        }
      } catch (e) { /* fall through to the error below */ }
    }
    if (!looksLikeBank(bytes)) { setReport({ logs: [{ level: 'err', text: '这个文件里没有 BKHD：既不是 bank，也不是含 bank 的音频 mod' }], outputs: [] }); return; }
    setBankFile({ name: f.name, bytes });
    setCached({ name: f.name, kb: Math.round(bytes.length / 1024) });
    void putBank(f.name, bytes);
    const logs: any[] = [{ level: 'ok', text: '基线 bank 已载入并缓存：' + Math.round(bytes.length / 1024) + ' KB ' + fromPkg }];
    if (fromPkg) logs.push({ level: 'warn', text: '注意：这个基线来自另一个 mod，它的音频也会一并带进结果。要纯净基线请用原版 bank。' });
    setReport({ logs, outputs: [] });
  }, []);

  const run = useCallback(() => {
    if (!patchFile || !bankFile) return;
    setBusy(true);
    setTimeout(function () {
      const res = fixPackage(patchFile.bytes, bankFile.bytes, patchFile.name, manifest, align);
      setReport(res.report);
      setOutputs(res.outputs);
      setBusy(false);
    }, 30);
  }, [patchFile, bankFile, manifest, align]);

  useEffect(function () {
    void (async function () {
      const got = await getBank();
      if (!got) return;
      setBankFile({ name: got.name, bytes: got.bytes });
      setCached({ name: got.name, kb: Math.round(got.bytes.length / 1024) });
    })();
  }, []);

  const autoFetch = useCallback(async function () {
    setFetchErr('');
    setFetching(1);
    try {
      const got = await fetchBaseline(function (p) {
        setFetching(p.total ? Math.round((p.loaded / p.total) * 100) : 1);
      });
      setBankFile({ name: 'bank-' + BASELINE.build + '.bin', bytes: got.bytes });
      setCached({ name: 'bank-' + BASELINE.build + '.bin', kb: Math.round(got.bytes.length / 1024) });
      await putBank('bank-' + BASELINE.build + '.bin', got.bytes);
      setReport({ logs: [{ level: 'ok', text: '已自动下载基线 bank（' + Math.round(got.bytes.length / 1024) + ' KB，sha256 ' + got.sha.slice(0, 12) + '）' }], outputs: [] });
    } catch (e) {
      setFetchErr(String((e as Error).message || e));
    } finally {
      setFetching(0);
    }
  }, []);

  const forget = useCallback(async function () {
    await clearBank();
    setCached(null);
    setBankFile(null);
  }, []);

  const logs = useMemo(function () { return report ? report.logs : []; }, [report]);

  return (
    <main className="wrap">
      <header>
        <h1>HD2 音频 Patch 修复器</h1>
        <p className="sub">把过期的音频 mod 重建成当前 build 可用。文件不会上传，全部在本机浏览器内处理。</p>
        <p className="tag">目标 build：26088801 ｜ 基线 bank 只需导入一次（存本机 IndexedDB）</p>
      </header>

      <section className="grid">
        <label className="drop">
          <span>1. 拖入 mod（.zip 或 .patch_0）</span>
          <input type="file" accept=".zip,.patch,.patch_0" onChange={function (e) { const f = e.target.files && e.target.files[0]; if (f) onPatch(f); }} />
          <em>{patchFile ? patchFile.name + ' · ' + Math.round(patchFile.bytes.length / 1024) + ' KB' : '未选择'}</em>
        </label>

        <label className="drop">
          <span>2. 基线 bank（当前 build 的原版音效库）—— 支持两种来源</span>
          <input type="file" onChange={function (e) { const f = e.target.files && e.target.files[0]; if (f) onBank(f); }} />
          <em>{bankFile ? bankFile.name + ' · ' + Math.round(bankFile.bytes.length / 1024) + ' KB' + (cached ? ' · 已缓存，下次自动载入' : '') : '未选择'}</em>
          {!bankFile ? (
            <span className="hint">
              基线 bank = 当前游戏 build 的原始 Wwise 音效库（4.4 MB）。重建时以它为骨架，把 mod 的音频换进去，事件层级（HIRC）才能对上。
              <button className="ghost" onClick={autoFetch} disabled={fetching > 0}>
                {fetching > 0 ? '下载中 ' + fetching + '%' : '自动下载基线 bank（build ' + BASELINE.build + '）'}
              </button>
              {fetchErr ? <span className="err"> {fetchErr}</span> : null}
              <span className="hint2">
                文件在哪？两条路：<br />
                ① 直接拖<b>任意一个已适配当前 build 的音频 mod</b>（zip 或 .patch_0）——它的 patch 里就装着完整 bank，本工具会自动从中提取；<br />
                ② 若你有导出的 <code>bank-26088801.bin</code>（4.4 MB，来自游戏 data 的 Wwise 音效库），直接拖它。
              </span>
            </span>
          ) : null}
        </label>
      </section>

      <section className="bar">
        <label>媒体对齐 <select value={align} onChange={function (e) { setAlign(Number(e.target.value)); }}>
          <option value={16}>16 字节（推荐）</option>
          <option value={4}>4 字节</option>
          <option value={1}>无对齐</option>
        </select></label>
        <button onClick={run} disabled={!patchFile || !bankFile || busy}>{busy ? '处理中…' : '开始修复'}</button>
        {cached ? <button className="ghost" onClick={forget}>清除缓存的基线 bank</button> : null}
        {outputs.map(function (o) {
          return <button key={o.name} className="dl" onClick={function () { download(o.name, o.bytes); }}>下载 {o.name}</button>;
        })}
      </section>

      <section className="log">
        <h2>处理日志</h2>
        {logs.length === 0 ? <p className="dim">还没有开始。</p> : null}
        <ul>
          {logs.map(function (l, i) {
            return <li key={i} className={l.level}>{l.level === 'ok' ? '✓' : l.level === 'warn' ? '!' : '✗'} {l.text}</li>;
          })}
        </ul>
        {report && report.patchName ? (
          <p className="dim">patch 名：{report.patchName}｜媒体 {report.mediaTotal} 个，替换 {report.mediaReplaced} 个</p>
        ) : null}
      </section>

      <footer>
        <p>做法：保留原 bank 的 BKHD / HIRC（事件层级），只替换 DIDX/DATA 里的媒体，并重算资源头长度。不要用「重写整个 bank」的做法。</p>
      </footer>
    </main>
  );
}