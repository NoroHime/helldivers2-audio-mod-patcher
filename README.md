# Helldivers 2 音频 Mod 修复器

把**过期的音频 mod** 重建成**当前游戏 build** 可用。纯前端，文件不上传、不联网也能跑。

在线使用：https://norohime.github.io/helldivers2-audio-mod-patcher/

## 为什么需要它

音频 mod 里装的是一个完整的 Wwise bank：

```
[16B 资源头] | BKHD | DIDX | DATA | HIRC
```

- `DIDX` 媒体索引（12 字节/条：媒体 id、DATA 内偏移、大小）
- `DATA` 所有 `.wem` 拼接
- `HIRC` **事件/声音层级**（决定「哪个事件播哪个媒体」）

游戏一更新，**HIRC 里的事件 id 全变**，旧 mod 的 bank 就失效 —— 表现为「装了没反应」或「部分音效错乱」。
修法是：拿**新 build 的原版 bank** 打底，把 mod 的媒体字节替换进去，`HIRC` 原样保留。

## 怎么用

1. 准备**当前 build 的原版 bank**（从游戏 `data` 目录导出，或下载对应 build 的基线包）。
2. 打开网页，拖入旧 mod（`.zip` 或 `.patch_0`）。
3. 拖入原版 bank。
4. 点「开始修复」，下载产出的 zip，装进 mod 管理器。

## Language / 语言

The UI ships in **Chinese and English** and picks the language **automatically** from the browser: any Chinese locale (`zh-CN`, `zh-TW`, `zh-HK`, `zh-Hant`, `zh_CN`, …) gets Chinese, everything else gets English. A top-right control offers `Auto / 中文 / EN`; only an explicit pick is remembered in `localStorage`, and `?lang=en` (or `?lang=zh-CN`) overrides everything — handy for sharing a link.
界面内置**中英双语**，并**自动**跟随浏览器语言：所有中文语系（`zh-CN`、`zh-TW`、`zh-HK`、`zh-Hant`、`zh_CN`…）→ 中文，其余一律英文。右上角可选 `自动 / 中文 / EN`；只有手动选过才会记进 `localStorage`，而 `?lang=en`（或 `?lang=zh-CN`）优先级最高，方便分享指定语言的链接。

## 基线 bank 从哪来

修复必须有一份**当前 build 的原版 Wwise 音效库**（约 4.4 MB）。它不是散落在 `data/` 里的独立文件，而是封在游戏的 `.dl_bin` 容器内。三条获取途径，按省事排序：

| # | 途径 | 说明 |
|---:|---|---|
| 1 | **页面上的「自动下载基线 bank」按钮** | 从本仓库 Release 拉 `bank-26088801.bin`，带 SHA-256 校验，存到本机 IndexedDB（只下一次） |
| 2 | **拖入任意一个已适配当前 build 的音频 mod**（zip 或 `.patch_0`） | 音频 mod 的 patch 里**本来就装着完整 bank**，本工具会自动从中提取。⚠️ 代价：那个 mod 的音频也会成为基线，结果里会带着它 |
| 3 | **用工具从游戏目录导出** | 用 [hd2-audio-modder](https://github.com/RaidingForPants/hd2-audio-modder) 打开 `<Steam>\steamapps\common\Helldivers 2\data`，找到音效 bank 导出 |

拿到后拖进第二个框即可，**只需一次**（之后浏览器会自动记住）。

## 它做了什么 / 不做什么

| 做 | 不做 |
|---|---|
| 用新 bank 的 HIRC/DIDX 结构重建 | 不重新编码音频（要换新音频请先用 Wwise 转 `.wem`） |
| 只替换能对上的媒体 id | 不改游戏本体文件 |
| 重算资源头长度、保持 16 字节对齐 | 不上传任何文件 |

## 正确性

`npm run selftest` 会用一份已知正确的成品做回归：产出的 `patch_0` 与其 **SHA-256 完全一致**。

```bash
npm install
npm run selftest   # 需要本机有测试用的 mod 与基线 bank
npm run dev        # 本地开发
npm run build      # 产物在 dist/
```

## 实现要点（踩过的坑）

| 坑 | 后果 | 正确做法 |
|---|---|---|
| 重建 bank 时只写回 BKHD/DIDX/DATA | **HIRC 丢了 → 游戏里完全没变化** | 所有其它 chunk 原样回写 |
| 忘记重算资源头 `u32@+4` | 声明长度 ≠ 实际，引擎切错长度 | 每次都重算 |
| patch 行里的 `+68/+72` 两个字段写 0 | 与原包不等价 | 从原包原样拷贝 |
| 文件尾部不对齐 | 与参考实现差十几字节 | 尾部补到 16 字节对齐 |