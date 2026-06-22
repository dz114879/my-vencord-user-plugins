# ReactionFilter

## 简介

`ReactionFilter` 用来隐藏指定 emoji 的消息反应。你可以把某些表情加入黑名单，让它们在反应栏里完全不显示。

## 使用方式

在插件设置中维护一份 emoji 黑名单：

- 原生 emoji：直接粘贴 emoji 字符本体。
- 自定义 emoji：推荐使用 `<:name:id>` 这种完整格式，匹配最精确。
- 也可以输入 `:name:` 或纯名字，这时会按 emoji 名称匹配。

添加完成后，命中的 reaction 会在你的客户端里被隐藏。

## 过滤模式

- `Hide on all messages`：隐藏所有命中的 reaction。
- `Only hide my own reactions`：只在当前 reaction 条目带有 `me` 标记时隐藏。

第二种模式的含义更接近“隐藏我自己点过的这类 reaction 条目”，而不是只隐藏 reaction 里的我自己那一部分头像或计数。

## 行为细节

- 命中的 reaction 会直接从渲染结果里移除。
- 如果一整条 reaction bar 里的项目都被隐藏了，整条 reaction bar 也会一起隐藏。
- 空白规则不会生效。
- 自定义 emoji 如果只按名字匹配，可能会把不同服务器里同名的 emoji 一起隐藏。

## 注意事项

- 如果你只想精确屏蔽某一个自定义 emoji，优先使用 `<:name:id>`。
- 这个插件是纯客户端过滤，不会真的删除 reaction，也不会影响别人看到的结果。
