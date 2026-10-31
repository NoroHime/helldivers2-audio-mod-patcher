// Minimal two-language dictionary (zh / en). No dependency, no async loading.
export type Lang = 'zh' | 'en';
export type Dict = Record<string, string>;

const zh: Dict = {
  'app.title': 'HD2 音频 Patch 修复器',
  'app.subtitle': '把过期的音频 mod 重建成当前 build 可用。文件不会上传，全部在本机浏览器内处理。',
  'app.tag': '目标 build：{build} ｜ 基线 bank 已内置（存本机 IndexedDB）',
  'app.lang': '语言',
  'app.step1': '1. 拖入 mod（.zip 或 .patch_0）',
  'app.step2': '2. 基线 bank（内置，自动载入；失败可手动拖入）',
  'app.unselected': '未选择',
  'app.ready': '已就绪',
  'app.loading': '载入中…',
  'app.cached': '已缓存',
  'app.baselineHint': '基线 bank = 当前游戏 build 的原始 Wwise 音效库（4.3 MB）。重建时以它为骨架，把 mod 的音频换进去，事件层级（HIRC）才能对上。',
  'app.fetching': '下载中 {pct}%',
  'app.fetchBtn': '重新下载内置基线',
  'app.whereTitle': '文件在哪？两条路：',
  'app.wherePath1': '① 直接拖任意一个已适配当前 build 的音频 mod（zip 或 .patch_0）—— 它的 patch 里就装着完整 bank，本工具会自动从中提取；',
  'app.wherePath2': '② 若你有导出的 bank-{build}.bin（4.3 MB，来自游戏 data 的 Wwise 音效库），直接拖它。',
  'app.align': '媒体对齐',
  'app.align16': '16 字节（推荐）',
  'app.align4': '4 字节',
  'app.align1': '无对齐',
  'app.run': '开始修复',
  'app.running': '处理中…',
  'app.clearCache': '清除缓存的基线 bank',
  'app.download': '下载 {name}',
  'app.logs': '处理日志',
  'app.noLogs': '还没有开始。',
  'app.summary': 'patch 名：{name}｜媒体 {total} 个，替换 {replaced} 个',
  'app.footer': '做法：保留原 bank 的 BKHD / HIRC（事件层级），只替换 DIDX/DATA 里的媒体，并重算资源头长度。不要用「重写整个 bank」的做法。',
  'log.zipOk': 'zip 解包成功：{name}',
  'log.patchOk': '直接读取 patch：{name}',
  'log.bankFromPkg': '（从 {name} 里的 bank 条目提取）',
  'log.bankLoaded': '基线 bank 已载入并缓存：{kb} KB {extra}',
  'log.bankFetched': '已自动下载基线 bank（{kb} KB，sha256 {sha}）',
  'warn.bankFromPkg': '注意：这个基线来自另一个 mod，它的音频也会一并带进结果。要纯净基线请用原版 bank。',
  'err.notZipPatch': '拖入的不是 zip 也不是 patch',
  'err.notBank': '这个文件里没有 BKHD：既不是 bank，也不是含 bank 的音频 mod',
  'err.noBank': '这个 patch 里没有 Wwise bank（可能只改 .stream 流式音频或文本），本工具修不了这种包',
  'err.noMatch': '这个 patch 的媒体 id 与基线 bank 一个都对不上 —— 要么基线 bank 不是同一个 build，要么这不是音频媒体包',
  'log.patch': 'patch：{n} 个条目，元数据非零 {meta}/60 字节',
  'log.noHirc': '基线 bank 里没有 HIRC —— 结果可能触发不了任何事件',
  'log.modBank': 'mod bank：{chunks} ／ {n} 个媒体',
  'log.mediaMatched': '媒体匹配：替换 {matched} 个，跳过（基线里没有）{skipped} 个',
  'log.dataSize': 'DATA 从 {before} 字节增至 {after} 字节',
  'log.outputPatch': '输出 patch：{n} 字节',
  'log.zip': '打包 zip：{n} 字节（level 9）',
  'err.zipNoPatch': 'zip 里没有 .patch / .patch_0',
  'err.zipBroken': 'zip 解包失败：{msg}',
  'log.raw': '{msg}',
  'err.baselineNoBkhd': '这个文件里没有 BKHD，不像是 bank',
};

const en: Dict = {
  'app.title': 'HD2 Audio Patch Fixer',
  'app.subtitle': 'Rebuild an outdated audio mod for the current build. Nothing is uploaded; everything runs in your browser.',
  'app.tag': 'Target build: {build} ｜ baseline bank bundled (cached in local IndexedDB)',
  'app.lang': 'Language',
  'app.step1': '1. Drop the mod (.zip or .patch_0)',
  'app.step2': '2. Baseline bank (bundled, auto-loaded; drop one if it fails)',
  'app.unselected': 'not selected',
  'app.ready': 'ready',
  'app.loading': 'loading…',
  'app.cached': 'cached',
  'app.baselineHint': 'The baseline is the original Wwise sound bank of the current build (4.3 MB). We rebuild on top of it so the event hierarchy (HIRC) keeps matching.',
  'app.fetching': 'downloading {pct}%',
  'app.fetchBtn': 'Re-download bundled baseline',
  'app.whereTitle': 'Where does the file come from? Two ways:',
  'app.wherePath1': '(1) Drop any audio mod that already works on the current build (zip or .patch_0) — its patch contains a complete bank and we extract it automatically.',
  'app.wherePath2': '(2) If you have an exported bank-{build}.bin (4.3 MB, the Wwise bank from the game data folder), just drop it.',
  'app.align': 'Media alignment',
  'app.align16': '16 bytes (recommended)',
  'app.align4': '4 bytes',
  'app.align1': 'none',
  'app.run': 'Fix it',
  'app.running': 'working…',
  'app.clearCache': 'Clear cached baseline',
  'app.download': 'Download {name}',
  'app.logs': 'Log',
  'app.noLogs': 'Nothing yet.',
  'app.summary': 'patch: {name} ｜ {total} media, {replaced} replaced',
  'app.footer': 'How it works: keep the original BKHD / HIRC (event hierarchy), replace only the media in DIDX/DATA, and recompute the resource header length. Never rewrite the whole bank.',
  'log.zipOk': 'zip unpacked: {name}',
  'log.patchOk': 'patch loaded directly: {name}',
  'log.bankFromPkg': ' (bank extracted from {name})',
  'log.bankLoaded': 'Baseline bank loaded and cached: {kb} KB {extra}',
  'log.bankFetched': 'Bundled baseline downloaded ({kb} KB, sha256 {sha})',
  'warn.bankFromPkg': 'Heads up: this baseline came from another mod, so that mod\'s audio is now part of your baseline. Use an original bank for a clean result.',
  'err.notZipPatch': 'That file is neither a zip nor a patch.',
  'err.notBank': 'No BKHD in this file: it is neither a bank nor an audio mod containing one.',
  'err.noBank': 'This patch carries no Wwise bank (it may only touch .stream or text), so it cannot be rebuilt here.',
  'err.noMatch': 'None of this patch\'s media ids exist in the baseline bank — wrong build, or this is not an audio media pack.',
  'log.patch': 'patch: {n} entries, {meta}/60 metadata bytes non-zero',
  'log.noHirc': 'Baseline bank has no HIRC — the result may not trigger any event',
  'log.modBank': 'mod bank: {chunks} / {n} media',
  'log.mediaMatched': 'media matched: {matched} replaced, {skipped} skipped (not in baseline)',
  'log.dataSize': 'DATA {before} -> {after} bytes',
  'log.outputPatch': 'output patch: {n} bytes',
  'log.zip': 'zip: {n} bytes (level 9)',
  'err.zipNoPatch': 'no .patch / .patch_0 inside this zip',
  'err.zipBroken': 'zip unpack failed: {msg}',
  'log.raw': '{msg}',
  'err.baselineNoBkhd': 'No BKHD in this file — it does not look like a bank',
};

const DICTS: Record<Lang, Dict> = { zh: zh, en: en };

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('hd2fixer.lang');
    if (saved === 'zh' || saved === 'en') return saved;
    const nav = (navigator.language || '').toLowerCase();
    return nav.indexOf('zh') === 0 ? 'zh' : 'en';
  } catch (e) {
    return 'en';
  }
}

export function saveLang(lang: Lang): void {
  try { localStorage.setItem('hd2fixer.lang', lang); } catch (e) { /* ignore */ }
}

export function t(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dict = DICTS[lang] || en;
  let s = dict[key];
  if (s === undefined) s = (zh[key] !== undefined ? zh[key] : key);
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.split('{' + k + '}').join(String(params[k]));
    }
  }
  return s;
}