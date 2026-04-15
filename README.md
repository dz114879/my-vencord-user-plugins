# My Vencord User Plugins

为 [Vencord](https://github.com/Vendicated/Vencord) 制作的 User Plugins。

## 目前可用的 Plugins

7/7:

- blockPlus: 更强大的屏蔽系统
- fakeAIFooter: 娱乐功能，自动为发出的消息增加AI输出内容风格的脚注
- keywordFilter: 关键词匹配的消息过滤插件，支持正则
- quickBlock: 快速屏蔽用户，无需确认
- quickPlusOne: 娱乐功能，快速复读其他用户的发言
- reactionFilter: 完全屏蔽用某个表情符号做出的反应
- scrollToTop: 更稳定的回顶按钮，在文字频道/子区也可用

具体说明请看各Plugins目录内的`README.md`。

## 如何使用

0. 安装[git](https://git-scm.com/downloads), [Node.js](https://nodejs.org/en/download/) 和 [pnpm](https://pnpm.io/installation)
1. `git clone https://github.com/dz114879/my-vencord-user-plugins`
2. `git clone https://github.com/Vendicated/Vencord`
3. 进入新出现的`Vencord\src`目录下新建`userplugins`目录
4. 将`my-vencord-user-plugins\(Plugin名字)`整个目录复制到`userplugins`目录下
  - 最终结构应该像这样: `Vencord\src\userplugins\blockPlus`
5. 在Vencord目录下打开PowerShell等终端，依次执行:
   1. `pnpm install --frozen-lockfile`
   2. `pnpm build` 或 `pnpm buildWeb`，取决于使用桌面版DC或网页DC
6. 
   - 如果你使用桌面版DC，不要关闭终端，继续执行`pnpm inject`; 
   - 如果你使用网页DC，先安装[Tampermonkey](https://www.tampermonkey.net), 然后用浏览器打开`Vencord\dist\Vencord.user.js`，Tampermonkey会自动提示安装。

## 许可证

GPL-3.0

