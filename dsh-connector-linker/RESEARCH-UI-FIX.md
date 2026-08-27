# 调研补遗 — 方案 C UI 一致性解法 (2026-08-27)

## 问题
dsh-mcp-connector (v0.2.25) UI 是独立 HTML+CSS，主题色 `--accent: #4f46e5`（浅紫）；与你 dsh-site-shell 风格（GitHub Dark `#0d1117/#161b22/#30363d` + DM Sans）不一致。直接 iframe 嵌入会"两层皮肤"。
直接挂 sidebar 入口也会与你 shell 的深色卡片冲突。

## 三条解法（按推荐度）

### 解法1：iframe + CSS overlay 覆盖（推荐）
- 在 dsh-site-shell 的「链接器」菜单点击 → 弹出/嵌入 dsh-mcp-connector 的 `ui/index.html` iframe
- iframe 加载后**等待 body 渲染**，注入 `:root` 覆盖 CSS variables：
  ```css
  iframe.contentWindow.document.documentElement.style.setProperty('--accent','#3fb950');
  documentElement.style.setProperty('--bg','#0d1117');
  // ...映射全部颜色变量
  ```
- 优点：不动 dsh-mcp-connector 源码，0 维护负担；它的版本升级自动跟随
- 缺点：CSS variable 偶尔有新增项未覆盖时仍偏色；需监 `MutationObserver` 防止页面切换时样式回滚
- 已有先例：你 AGENTS.md 里有"网站区 iframe 嵌官方渲染器"决策，路径一致

### 解法2：写薄 wrapper 插件调其 API + 自渲染卡片
- 直接读 dsh-mcp-connector 的 `/api/v1/catalog` 与 `/api/v1/installed` 端点（已暴露）
- 在 dsh-site-shell 里写 ~200 行 client 代码，按你的图2 风格重渲染卡片
- 优点：UI 完全你控，零 iframe
- 缺点：每次 dsh-mcp-connector API 升级需跟随；Prompt/工具详情需自渲染（≈400 行）

### 解法3：Fork dsh-mcp-connector 改主题
- clone → 全局替换 CSS 变量 → 发包
- 优点：彻底本地化
- 缺点：上游 v0.2.25 → v0.3 升级要反复合并；维护负担最大

## 推荐组合
**解法1（iframe + CSS overlay）作为 v0.1** + **解法2（薄 wrapper 渲染卡片）作为 v0.2 渐进替换**

## 工作量
- v0.1：5 行 CSS overlay 注入 + dsh-site-shell 加「链接器」菜单（已为你熟悉的栈）
- v0.2：~600 行 client（cards 渲染 + 详情页）+ 读 dsh-mcp-connector 公开 API
- 总计：半天可完成

## 不需要做的事
- 不实现 MCP 协议层（dsh-mcp-connector 已实现 stdio+streamableHttp+OAuth PKCE）
- 不实现 Registry（dsh-mcp-connector 已含 78 条 + 内置 4 张企查查 = 82 张）
- 不实现安装/鉴权/连接持久化（全在 dsh-mcp-connector）
- 不必导入 workbuddy 模板（dsh-mcp-connector Registry 已含飞书/钉钉/TAPD/腾讯文档/腾讯会议/…等大多数）