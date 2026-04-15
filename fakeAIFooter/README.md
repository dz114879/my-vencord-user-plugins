# FakeAIFooter

## 简介

`FakeAIFooter` 会在你发送消息前，自动在末尾追加一行“像大模型输出统计”的假尾注，用来营造 AI 回答的效果。

默认追加格式大致如下：

```text
-# Time:12.345s | In:28765t | Out:36t
```

其中：

- `Out` 是根据消息内容估算出来的输出 token 数。
- `In` 是随机生成的输入 token 数。
- `Time` 是用 `Out / 随机 TPS` 算出的伪造耗时。

## 计数逻辑

- 中日韩字符按 `2 token` 计。
- 其他字符按 `1 token` 计。
- `In` 会在 `20000` 到 `50000` 之间随机生成。
- `Time` 会根据设置里的基础 TPS 和波动范围随机变化，所以不会每次都一样。

## 默认会跳过的消息

以下情况默认不会追加尾注：

- 空消息
- 斜杠命令
- 只有一个原生 emoji 的消息
- 只有一个自定义服务器 emoji 的消息
- 只有一个 FakeNitro 表情或贴纸链接的消息
- 只有单独链接或 Markdown 链接的消息

如果你关闭对应过滤选项，单个 emoji / FakeNitro 链接也可以继续追加尾注。

## 设置项

- `filterSingleNativeEmoji`：当消息只有一个原生 emoji 时不追加尾注，默认开启。
- `filterSingleServerEmoji`：当消息只有一个服务器 emoji（如 `<:name:id>`）时不追加尾注，默认开启。
- `filterSingleFakeNitroItem`：当消息只有一个 FakeNitro 表情或贴纸链接时不追加尾注，默认开启。
- `fakeTps`：基础伪造 TPS，默认 `1.5`。
- `fakeTpsVariance`：在基础 TPS 上附加的随机波动范围，默认 `0.5`。

## 注意事项

- 这个插件只会改动要发送的文本内容，不会处理附件、Embed 或其他富内容。
- 如果其他功能正在使用模拟流式输出标记，本插件会跳过本次发送，避免重复追加类似尾注。
- 这是一个纯整活插件，数据没有任何真实含义。
