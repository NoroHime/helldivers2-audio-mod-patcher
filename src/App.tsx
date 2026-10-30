import { useCallback, useMemo, useState } from 'react';
import { fixPackage, extractFromZip, looksLikeZip, looksLikePatch, looksLikeBank, type FixReport } from './lib/fix';

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
    const bytes = await readFile(f);
    if (!looksLikeBank(bytes)) { setReport({ logs: [{ level: 'err', text: '这个文件里没有 BKHD，不像是 bank' }], outputs: [] }); return; }
    setBankFile({ name: f.name, bytes });
    setReport({ logs: [{ level: 'ok', text: '基线 bank 已载入：' + f.name + '（' + Math.round(bytes.length / 1024) + ' KB）' }], outputs: [] });
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

  const logs = useMemo(function () { return report ? report.logs : []; }, [report]);

  return (
    <main className="wrap">
      <header>
        <h1>HD2 音频 Patch 修复器</h1>
        <p className="sub">把过期的音频 mod 重建成当前 build 可用。文件不会上传，全部在本机浏览器内处理。</p>
      </header>

      <section className="grid">
        <label className="drop">
          <span>1. 拖入 mod（.zip 或 .patch_0）</span>
          <input type="file" accept=".zip,.patch,.patch_0" onChange={function (e) { const f = e.target.files && e.target.files[0]; if (f) onPatch(f); }} />
          <em>{patchFile ? patchFile.name + ' · ' + Math.round(patchFile.bytes.length / 1024) + ' KB' : '未选择'}</em>
        </label>

        <label className="drop">
          <span>2. 拖入当前 build 的原版 bank</span>
          <input type="file" onChange={function (e) { const f = e.target.files && e.target.files[0]; if (f) onBank(f); }} />
          <em>{bankFile ? bankFile.name + ' · ' + Math.round(bankFile.bytes.length / 1024) + ' KB' : '未选择（从游戏 data 目录取，或下载对应 build 的基线包）'}</em>
        </label>
      </section>

      <section className="bar">
        <label>媒体对齐 <select value={align} onChange={function (e) { setAlign(Number(e.target.value)); }}>
          <option value={16}>16 字节（推荐）</option>
          <option value={4}>4 字节</option>
          <option value={1}>无对齐</option>
        </select></label>
        <button onClick={run} disabled={!patchFile || !bankFile || busy}>{busy ? '处理中…' : '开始修复'}</button>
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