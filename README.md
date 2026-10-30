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