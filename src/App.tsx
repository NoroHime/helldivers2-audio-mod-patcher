import { useCallback, useEffect, useMemo, useState } from 'react';
import { fixPackage, extractFromZip, extractBankBytes, looksLikeZip, looksLikePatch, looksLikeBank, type FixReport } from './lib/fix';
import { putBank, getBank, clearBank } from './lib/storage';
import { BASELINE, fetchBaseline } from './lib/baseline';
import { detectLang, saveLang, t as tr, type Lang } from './lib/i18n';

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
  const [lang, setLang] = useState<Lang>(function () { return detectLang(); });
  const [manual, setManual] = useState<boolean>(function () { try { return !!localStorage.getItem('hd2fixer.lang'); } catch (e) { return false; } });
  const t = useCallback(function (key: string, params?: Record<string, string | number>) { return tr(lang, key, params); }, [lang]);

  useEffect(function () {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = tr(lang, 'app.title');
  }, [lang]);

  const switchLang = useCallback(function (next: Lang) {
    setLang(next);
    setManual(true);
    saveLang(next);
  }, []);

  const useAuto = useCallback(function () {
    setManual(false);
    try { localStorage.removeItem('hd2fixer.lang'); } catch (e) { /* ignore */ }
    setLang(detectLang());
  }, []);

  const onPatch = useCallback(async (f: File) => {
    const bytes = await readFile(f);
    if (looksLikeZip(bytes)) {
      const got = extractFromZip(bytes);
      if (got.errorKey || !got.patch) { setReport({ logs: [{ level: 'err', key: got.errorKey || 'err.zipNoPatch', params: got.errorMsg ? { msg: got.errorMsg } : undefined }], outputs: [] }); return; }
      setPatchFile(got.patch);
      setManifest(got.manifest || null);
      setReport({ logs: [{ level: 'ok', key: 'log.zipOk', params: { name: got.patch.name } }], outputs: [] });
    } else if (looksLikePatch(bytes)) {
      setPatchFile({ name: f.name, bytes });
      setManifest(null);
      setReport({ logs: [{ level: 'ok', key: 'log.patchOk', params: { name: f.name } }], outputs: [] });
    } else {
      setReport({ logs: [{ level: 'err', key: 'err.notZipPatch' }], outputs: [] });
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
          if (bank) { bytes = bank; fromPkg = f.name; }
        }
      } catch (e) { /* fall through to the error below */ }
    }
    if (!looksLikeBank(bytes)) { setReport({ logs: [{ level: 'err', key: 'err.notBank' }], outputs: [] }); return; }
    setBankFile({ name: f.name, bytes });
    setCached({ name: f.name, kb: Math.round(bytes.length / 1024) });
    void putBank(f.name, bytes);
    const logs: any[] = [{ level: 'ok', key: 'log.bankLoaded', params: { kb: Math.round(bytes.length / 1024), extra: fromPkg ? t('log.bankFromPkg', { name: fromPkg }) : '' } }];
    if (fromPkg) logs.push({ level: 'warn', key: 'warn.bankFromPkg' });
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
      if (got) {
        setBankFile({ name: got.name, bytes: got.bytes });
        setCached({ name: got.name, kb: Math.round(got.bytes.length / 1024) });
        return;
      }
      // built-in baseline: download once from the site itself, verify, then cache
      try {
        setFetching(1);
        const got2 = await fetchBaseline(function (p) {
          setFetching(p.total ? Math.round((p.loaded / p.total) * 100) : 1);
        });
        setBankFile({ name: 'bank-' + BASELINE.build + '.bin', bytes: got2.bytes });
        setCached({ name: 'bank-' + BASELINE.build + '.bin', kb: Math.round(got2.bytes.length / 1024) });
        await putBank('bank-' + BASELINE.build + '.bin', got2.bytes);
      } catch (e) {
        setFetchErr(String((e as Error).message || e));
      } finally {
        setFetching(0);
      }
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
      setReport({ logs: [{ level: 'ok', key: 'log.bankFetched', params: { kb: Math.round(got.bytes.length / 1024), sha: got.sha.slice(0, 12) } }], outputs: [] });
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
        <div className="head">
          <h1>{t('app.title')}</h1>
          <div className="langs">
            <button className={!manual ? 'on' : ''} onClick={useAuto} title="auto by browser">{t('app.auto')}</button>
            <button className={manual && lang === 'zh' ? 'on' : ''} onClick={function () { switchLang('zh'); }}>中文</button>
            <button className={manual && lang === 'en' ? 'on' : ''} onClick={function () { switchLang('en'); }}>EN</button>
          </div>
        </div>
        <p className="sub">{t('app.subtitle')}</p>
        <p className="tag">{t('app.tag', { build: BASELINE.build })}</p>
      </header>

      <section className="grid">
        <label className="drop">
          <span>{t('app.step1')}</span>
          <input type="file" accept=".zip,.patch,.patch_0" onChange={function (e) { const f = e.target.files && e.target.files[0]; if (f) onPatch(f); }} />
          <em>{patchFile ? patchFile.name + ' · ' + Math.round(patchFile.bytes.length / 1024) + ' KB' : t('app.unselected')}</em>
        </label>

        <label className="drop">
          <span>{t('app.step2')}</span>
          <input type="file" onChange={function (e) { const f = e.target.files && e.target.files[0]; if (f) onBank(f); }} />
          <em>{bankFile ? t('app.ready') + ' · ' + Math.round(bankFile.bytes.length / 1024) + ' KB' + (cached ? ' · ' + t('app.cached') : '') : t('app.loading')}</em>
          {!bankFile ? (
            <span className="hint">
              <span>{t('app.baselineHint')}</span>
              <button className="ghost" onClick={autoFetch} disabled={fetching > 0}>
                {fetching > 0 ? t('app.fetching', { pct: fetching }) : t('app.fetchBtn')}
              </button>
              {fetchErr ? <span className="err"> {fetchErr}</span> : null}
              <span className="hint2">
                {t('app.whereTitle')}<br />
                {t('app.wherePath1')}<br />
                {t('app.wherePath2', { build: BASELINE.build })}
              </span>
              </span>
          ) : null}
        </label>
      </section>

      <section className="bar">
        <label>{t('app.align')} <select value={align} onChange={function (e) { setAlign(Number(e.target.value)); }}>
          <option value={16}>{t('app.align16')}</option>
          <option value={4}>{t('app.align4')}</option>
          <option value={1}>{t('app.align1')}</option>
        </select></label>
        <button onClick={run} disabled={!patchFile || !bankFile || busy}>{busy ? t('app.running') : t('app.run')}</button>
        {cached ? <button className="ghost" onClick={forget}>{t('app.clearCache')}</button> : null}
        {outputs.map(function (o) {
          return <button key={o.name} className="dl" onClick={function () { download(o.name, o.bytes); }}>{t('app.download', { name: o.name })}</button>;
        })}
      </section>

      <section className="log">
        <h2>{t('app.logs')}</h2>
        {logs.length === 0 ? <p className="dim">{t('app.noLogs')}</p> : null}
        <ul>
          {logs.map(function (l, i) {
            return <li key={i} className={l.level}>{l.level === 'ok' ? '✓' : l.level === 'warn' ? '!' : '✗'} {t(l.key, l.params)}</li>;
          })}
        </ul>
        {report && report.patchName ? (
          <p className="dim">{t('app.summary', { name: String(report.patchName), total: String(report.mediaTotal), replaced: String(report.mediaReplaced) })}</p>
        ) : null}
      </section>

      <footer>
        <p>{t('app.footer')}</p>
      </footer>
    </main>
  );
}