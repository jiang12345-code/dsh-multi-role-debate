# LESSONS_LEARNED.md — 踩坑与修复 SSOT

> 本文件记录本工作区遇到的问题 + 具体解决办法 + 最快诊断路径。新会话遇到问题时**先查这里**，避免重复踩坑。
> 维护约定：每修完一个非平凡 bug，追加一条（问题现象 / 根因 / 修复 / 最快诊断法）。与 AGENTS.md 分工：AGENTS.md 记"系统是什么"，本文件记"踩过什么坑、怎么爬出来的"。

---

## 2026-08-27 · dsh-openrouter-free 面板空白（跨 1 天的调试马拉松）

### 问题现象
「免费模型」标签出现，但内容区一片空白；硬刷新无效；多次重启 DSH 无效。

### 排查过程中走过的弯路（引以为戒）
1. **误诊为 host 路由未注册**：用 pwsh `Invoke-RestMethod` POST `{"method":"ping"}` 得到 404，误以为插件没加载。**实际原因：`ping` 是 dsh-self-restart 的方法名，不是本插件的**——本插件方法是 `free.list/current/model.use/sync.all`。把 A 插件的方法名打到 B 插件端点上，404 响应体 `{"ok":false,"error":"unknown method ping"}` 其实说明**路由已注册、请求已到达**。
2. **盲目重启多次**：改了配置就重启，没先拿到决定性证据，浪费多轮。
3. **在错误路径上反复编辑**：见下条"双目录陷阱"。
4. **手写长 JSX 反复改坏**：为加分级星标手写 React.createElement 嵌套，改了 N 次括号仍错；最后一次重写把 `Panel` 函数定义在渲染回调里却**忘了 `return React.createElement(Panel, props)`**——箭头函数返回 undefined，React 渲染空气，这就是"空白"的最终根因。

### 根因（最终）
渲染回调定义了 Panel 但没有 return 它：`(props) => { function Panel() {...} }` ← 缺 `return React.createElement(Panel, props)`。

### 修复
在 Panel 函数定义后补一行 `return React.createElement(Panel, props)`。宿主端（`/__orfree/api`）从头到尾都是好的。

### 最快诊断法（下次直接按此路径，5 分钟定位）
1. **标签出现 = client 模块加载成功**（slot 注册了）；空白 = 渲染或数据问题，不是加载问题。
2. **用 curl.exe 读 404 响应体**（PowerShell 的 Invoke-RestMethod 看不到 body）：
   - `{"ok":false,"error":"unknown method X"}` → 路由在，方法名错（查插件自己的方法列表）
   - 空 body / HTML → 路由真没注册（查 bundle 是否加载）
   - 命令：`curl.exe -s -X POST 'http://127.0.0.1:3080/__orfree/api' -H 'content-type: application/json' --data-binary "@body.json" -w '|HTTP%{http_code}'`（body 写临时文件，**避免 PowerShell 引号转义地狱**）
3. **mock 加载 host 文件验证 apply()**：`await import(fileUrl)` + 假 ctx（get/effect/logger）跑一遍，立刻知道路由能否注册、有无运行时抛错（本会话建了 `test-orfree-load.mjs` 可复用改路径）。
4. **host 正常 + 面板空白 → 100% 是 client 渲染问题**：直接读部署的 client.js **文件尾部**，检查渲染回调是否 return 了组件。
5. **起第二个 DSH 实例抓启动日志**：`pnpm dsh web --no-open --port 3081`（注意 dsh-pocket 端口被占会自动代理到 3082），日志落 `$env:TEMP`，看 Cordis 报错。
6. **一键技能（首选）**：以上 1-5 已封装为 `trajectory-search` 技能——
   `node "C:\Users\73618\.dsh\skills\trajectory-search\scripts\traj-search.mjs" <关键词...> [--project 技术] [--since 7d]`
   自动多帧 zstd 解压（扫描算法照抄 session-persistence-jsonl 官方实现）+ 多关键词 grep + 项目名中文还原。实战验收：本次马拉松复盘一发命中 18 会话 253 行。

---

## 通用陷阱（跨项目复用）

### 1. 双目录陷阱：`技术问题解决` vs `技术问题解決`
`D:\dsh` 下同时存在 `技术问题解决`（正确）和 `技术问题解決`（"決"是异体字，编辑工具误创建）两个目录。会话中多次把文件写进错误目录，导致"源码改了没生效"的假象。
**防范**：写文件前先 `Get-ChildItem D:\dsh -Directory | ? Name -like '*技术*'` 确认真源；发现异体目录及时合并清理。

### 2. 多轮手写 JSX 必坏：改 UI 用"最小 diff"或"整文件重写"
手写 `React.createElement` 深嵌套时，多次增量 edit 极易括号失衡（本次连续失败 6+ 次）。
**规矩**：① 小改动只做"同层表达式替换"（不改嵌套层级）；② 大改动整文件重写并在渲染回调末尾**自查 return**；③ 改完必跑 `node --check`；④ 面板类组件按"helper 函数（makeRow 等）在 return 之外定义"的模式写，减少 JSX 内联复杂度。

### 3. 渲染回调必须 return 组件
DSH client slot 模式：`slots.register({...}, (props) => React.createElement(Comp, props))`。若在回调里定义函数再渲染，**最后一行必须是 return**。返回 undefined = 空白无报错。

### 4. 测试插件 API 先查"它自己有哪些方法"
每个插件的方法名不同（openrouter-free: `free.list/current/model.use/sync.all/free.remove`；self-restart: `ping/status/schedule/task.add/task.done/task.list`）。跨插件测试前先看该插件 README 或源码 api 对象，**不要复用另一个插件的方法名**。

### 5. 权限与重启（已在 AGENTS.md，此处留索引）
杀提权 DSH 进程 → `schtasks /rl HIGHEST` 一次性任务或 WMI 分离 spawn；宿主非提权时普通权限可直接 taskkill；restart-dsh.ps1 已固化于 `~/.dsh/`。

---

## 2026-08-27 · 多角色论证「直接对话」无持久记忆（Claude/Codex 双实体）

### 问题现象
多角色论证面板与 Claude 直接对话时没有持久对话记忆——刷新页面或重启 DSH 后，每条消息都像第一次见面；codex 同理。

### 根因（双层叠加）
1. **宿主实体层**：claude 的 `chatSessions` / codex 的 `_threads` 会话映射是**进程内 Map**——DSH 重启即清零；key 失效后每条消息都新开会话 = 全面失忆。
2. **前端层**：chatKey 存在 React state 里，页面刷新/切 tab 即丢；配合上游 key 失效加剧。

### 修复
1. `dsh-claude-agent`：会话映射落盘 `~/.dsh/claude-agent/chat-sessions.json`（启动 hydrate + 每次变更写盘）。
2. `dsh-codex-agent`：线程映射落盘 `~/.dsh/codex-agent/threads.json`（启动 hydrate；resume 失败自动回退新 thread，绝不硬断）。
3. 前端 chatKey 存 localStorage（按 sessionId 分桶：`mrd-chatkeys:<sessionId>`），刷新/切 tab 都能续接。
4. 面板加「模型切换检测」：检测到该 agent 生效模型变化时清掉旧 key、插一条系统提示行（`.mrd-sys-line`）。

### 实测证据
同一 chatKey 连发两条 role.chat：第一条种暗号 MAGPIE-42 → 答"已记住"；第二条索回 → 精确答出 MAGPIE-42。`check_health` 全程 FAIL=0。

### 最快诊断法
直接对 `/__dsh-mrd/api` 同一 chatKey 连发两条 role.chat（首条种暗号、次条索暗号），一轮就能区分是「实体层断」「前端 key 断」还是「一切正常只是没等渲染」。看落盘文件是否生成：`~/.dsh/claude-agent/chat-sessions.json`。
