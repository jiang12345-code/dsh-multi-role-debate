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

## 2026-08-28 · dsh-site-connector 首次加载把 DSH 前端打挂（client.js 三连违规）

### 问题现象
dsh-site-connector 部署后 DSH 前端无法访问（3080 起来但页面挂）。宿主日志三个报错：`bundle loaded without registering`、`Cannot read properties of undefined (reading 'useState')`、`Invalid effect`。

### 根因（三条全是 client.js 写作违规，且正确范式当时就在上下文里）
1. **裸函数导出**：写了 `module.exports = function init(ctx)`，没按规范包 `window.__ModuleLoader__.load({ id, factory })`——dsh-plugin-development skill 明文写了此格式，且本会话刚读过 dsh-agent-sync/client.js 第 5-11 行的正确范例。
2. **`window.React`**：dsh 环境不提供全局 React，必须 `require('react')`——dsh-agent-sync/client.js 第 11 行 `var React = require('react')` 就在上下文里，仍写错。
3. **slots API 误用**：`slots.inject('settings.section', () => ({...}))` 返回裸对象不是合法注册；正确是 `slots.register({ name, id, order, label }, Component)`——dsh-agent-sync/client.js 第 1034 行的注册对象形态也在上下文里。

**元根因**：写代码时用了自己脑内的模板，而不是复制「刚读过、已验证可工作」的同仓插件骨架。「验证>信任」做在了读，没做在写。

### 修复（Marvis 排查修复，已验证）
① 包 `window.__ModuleLoader__.load({ id: 'dsh-site-connector', factory: (require) => {...} })` 并导出 apply；② `const React = require('react')`；③ `slots.register({ name: 'settings.section', id, order, label }, Component)`。三处已同步 node_modules 与源目录，vm 模拟验证注册/apply/slots 注入全通过。

### 实测证据
重启后 3080 监听正常、首页 200 含 `__DSH_BOOT__`；设置侧栏出现「🧩 连接器」。

### 最快诊断法
① 宿主日志第一行 `bundle loaded without registering` = client.js 没调 `__ModuleLoader__.load`，一眼定位；② 部署前用 vm 模拟跑一遍注册（load→factory→apply→slots.register），三处违规任一都会在模拟里爆，不用等真实重启；③ `node --check` 只保语法不保运行时 API——它通过 ≠ 插件能加载，绝不能当部署门槛的唯一关卡。

### 写作铁律（新增）
新写 client.js 的第一步 = 打开 profile node_modules 里一个已知能跑的插件 client.js（推荐 dsh-agent-sync），**复制它的骨架**（load 包裹 / require('react') / slots.register 形态），再往里填业务；禁止凭记忆或自造模板从零写。

### host 侧第四坑（同日追加 · 三层根因 · 探针三轮定位）
- **现象**：client 修好后面板仍无数据——`/site-connector/api` GET=404 / POST=405，路由从未注册；但 dump-config 里行存在、模块 import 正常，三证据互相矛盾。
- **根因三层**：
  1. apply 时刻 webServer 未就绪，`ctx.get('webServer'); if(!web) return` = **静默退出**永不注册 → 必须 `ctx.inject(['webServer',...], cb)` 响应式（dsh-agent-sync L1802 同款）。
  2. `ctx.inject` 回调参数是 **ctx 不是 service**——直接 `scope.register()` 报 `cannot get property "register" without inject`（Cordis Fiber 守卫）。必须回调内属性访问：`wctx.webServer.register(...)`（dsh-mcp-connector web.js L167 同款）或 `scope.get('webServer')`（agent-sync 同款）。
  3. `kind:'prefix'` 路由必须**同时注入 webRuntime**（mcp-connector 注 `['webServer','webRuntime']`）；`kind:'exact'` 只须 webServer（agent-sync）。
- **最快诊断法（本次一发命中）**：在 apply / inject 回调 / register 三处埋 `appendFileSync` 探针写 `~/.dsh/<插件名>-boot.log`，重启一次即定位到具体环节。⚠️ dump-config 只证明「行在组合配置里」，**不证明 apply 被调用**；`node --check`/直接 import 只证明语法与导出形态，都不证明运行时注册成功。
- **实测**：探针第三轮定位后 `register done, disposer=function`，POST /site-connector/api = 200。

### 防错基建（2026-08-28 建成 · 单一 SSOT 在 skill 内）
本条教训已固化为**可执行门禁 + 骨架模板**，全部住在 `C:\Users\73618\.dsh\skills\dsh-plugin-development\`：
- `references/client-skeleton.js` / `references/host-skeleton.js` —— 从 dsh-agent-sync（exact 形态）与 dsh-mcp-connector（prefix 形态）现役源码提炼的可复制骨架，铁律注释内嵌。**写码前先复制骨架，禁止自造模板**（本次 4 坑全部源于"读过正确范例仍凭记忆写"）。
- `scripts/preflight.mjs` —— 部署门禁：静态扫描（load 包裹/window.React/裸导出/slots.register 形态/ctx.get 静默 return 反模式/prefix 缺 webRuntime/manifest 发明键）+ vm 冒烟（模拟 loader 加载链 load→factory→apply→slots.register 全链路）。**部署前必须跑，非 0 退出不得 Copy-Item**。可独立运行：`node <skill>/scripts/preflight.mjs <插件目录>`。
- **双验证记录**：真实插件 dsh-site-connector 跑过 = 全绿放行；故意注入 8 处原始违规的坏插件 = 全部拦截（exit 1）。门禁真实有效。
- SKILL.md Workflow 已把「写前复制骨架」「部署前跑 preflight」写成第 2/6 步硬规则。

---

## 2026-08-28 · awesome-dsh-plugin 市场收录 PR 四坑（dsh-multi-role-debate PR #3605）

### 现象
首次提 PR #3605，`Submission gate` 失败 `the entry points at the repository root, but the root package.json declares no dsh.bundle`。本地 `node scripts/check-submission.mjs` 不带 `--base` 时误报 "PR adds 2468 entries"。

### 根因（四条实战坑，每条都踩过）
1. **根 URL ≠ 子包 URL**：多包 monorepo（root `package.json` 是 workspace 壳，无 `dsh.bundle`）必须指 subpackage。`url` = `https://github.com/<o>/<r>/tree/main/<subdir>`，`name` = `<o>/<r>#<subdir>`。安装命令 `dsh plugin add github:o/r` 解析到哪个子包取决于聚合包的 deps。
2. **文件 slug 规则（来自 `scripts/lib/entries.mjs` 的 `slugFor`）**：子包条目文件名 = `<owner>__<repo>--<subdir-with-slashes-to-hyphens>.yml`（双短横分隔，不是下划线）。同一 entry 的 `url` + `name` + 文件名三者必须对齐，否则 `filename must match the url` 错误。
3. **本地 checker 的“PR diff”基线不可靠**：本地跑 `node scripts/check-submission.mjs` 不带 `--base` 时默认用 HEAD 自己，导致 "added N entries"（其实已经在了）。**权威值是 `gh api repos/<upstream>/<r>/compare/main...<fork>:<branch>` 的 `ahead/behind/files`**（本次：ahead=1, behind=0, files=4，完美）。本地要带 `--base origin/main` 才准。
4. **PowerShell + node -e 引号转义反复爆炸**：`node -e "..."` 含 `\r\n` 会被 PS 当字符串解析掉。**统一走临时 .mjs 文件**（`@'...'@ | Set-Content _x.mjs; node _x.mjs; Remove-Item _x.mjs`），避免一次性脚本陷入引号地狱。

### 修复（最终通过版 PR #3605 commit `507e359`）
- yml：`url` 指 `tree/main/dsh-multi-role-debate`，`name` 用 `#dsh-multi-role-debate`，category=workflow
- 文件：`data/plugins/jiang12345-code__dsh-multi-role-debate--dsh-multi-role-debate.yml`（双短横）
- screenshots.json：原 key 是根仓 URL → 换成子包 URL key（screenshots 本身在根仓 docs/ 仍可用 raw.githubusercontent）
- 两份 README 用 `node scripts/generate-readme.mjs` 重生成（提交后会被自动检测；勿手改 README）

### 最快诊断法（提同类 PR 三步必跑）
1. `gh api repos/<upstream>/<repo>/compare/main...<fork>:<branch>` 拿权威 `ahead/behind/files` —— 必须是 `ahead=1`、file count 符合预期、files 列表只有你改的。否则本地 checker 一定误报。
2. 复刻 GitHub CI 调法本地跑：`node scripts/check-submission.mjs --only-list /tmp/mylist.txt --pr-created <iso> --json gate-result.json`（mylist.txt = 你新加的文件名一行）。看 `gate-result.json` 的 `failures[].problems`。
3. 失败信息含 `the root package.json declares no dsh.bundle` → 100% 是多包 monorepo 没指 subpackage，按上面 slug 规则改三件套。

### GitHub CI 端
`pr-check.yml` 跑 lint/syntax；`pr-gate.yml`（workflow_run 触发，base 仓库上下文，有 token 权限）跑 `check-submission.mjs --only-list`。两个都绿才合并。两个 workflow_run 错开几十秒，轮询要等。

---

## 2026-08-29 · dsh-self-restart 自动续跑三层修复链（"重启后任务没继续"马拉松）

### 问题现象
自助重启插件 v0.2.0→v0.3.0 演进中，"重启后任务自动续跑"始终不生效：账本 `resumedAt` 已写（看似成功），但目标会话没有任何新 turn；用户仍需逐个人工通知继续。过程中出现两类崩溃：`Cannot read properties of undefined (reading 'kind')` 与 `prompt variable "{{model}}" has no value for this assembly (section "deployment:persona")`。

### 根因（三层，层层独立毙掉续跑）
1. **followup(纯字符串) = 毒消息**（v0.2.0 起潜伏）：字符串被规范化成**无 source 字段**的 user/message；引擎 `RuntimeContextProjection.isOwned()`（`packages/core/agent-loop/src/runtime-context.ts` L16）读 `message.source.kind` 不设防 → 注入事件一落 `session/event`，**刚拉起的 turn 立即崩死**（日志法证实证：turn/start → inbox claim → turn/end error，消息随之丢失）。引擎规范 UserMessage 必须是 `{id, role:'user', content:[{type:'text',text}], source:{kind:'plugin', plugin:'<名>'}}`（`packages/llm/llm/src/message.ts` createUserMessage；schedule 包 runtime.ts L271-275 是生产范例）。
2. **未加载会话不能只靠 agents.get()**：重启后只有被 UI/触发方加载过的会话才在 agents 注册表里；其余一律 `agent/session unavailable`。正解 = **materialize**：`agents.resume({ resumeSessionId })`（与子代理运行时唤醒持久化会话同款，`packages/subagent/subagent/src/continuation.ts` L1072）。两个子坑：resumeSessionId 必须**裸 uuid**（持久层规范形态，带 `session-` 前缀会抛 inactive context）；**必须传 `agentOptions:{provider,model}`**（取 `agentDefaultModel.currentSelection()`）——persona 的 `{{model}}` 来自 `agent.options.model`（agent-loop L352），缺了 deployment:persona 组装直接抛"prompt variable has no value"。
3. **账本观感坑**：成功时不清残留 resumeError → "resumedAt+resumeError 并存"误导诊断半小时（v0.3.1 已修=成功即清）。

### 修复（v0.3.3 全链）
① followup 传规范 UserMessage（含 source）；② materialize fallback：agents.get 三形态探测失败 → `agents.resume({resumeSessionId: 裸uuid, agentOptions:{provider,model}})`；③ 成功清 resumeError + 写 `resumeVia: live|materialized` 可观测；④ 开机 8s 首跑 + 45s×12 重试网（attempts≤3 防僵尸）；⑤ 新 API：`scan`（干跑发现）/ `wake`（手动触发续跑）。

### 最快诊断法（本次一发命中）
**多帧 zstd 会话日志法证**：node + `zlib.zstdDecompressSync` 按 magic `28 B5 2F FD` 切帧逐帧解压（坏帧跳过），grep `turn/end` 的 `reason.error` + 注入关键词，看注入点后 5-10 条事件即可三分判定：**没注入 / 注入但 turn 崩（有 turn/end error）/ 真实续跑（有 step+assistant 事件）**。现成脚本：`%TEMP%\log-tail-forensics.mjs`（只读，支持关键词定位模式）。账本 resumedAt ≠ turn 存活，**永远以会话日志为准**。

### 已知边界（诚实记录）
- 裸 uuid 旧格式会话（如 f189dd65）materialize 抛 `cannot create effect on inactive context`（疑子代理会话须走 `subagents.followup(parent, childId)` 专路，需要 parent agent——未解，账本留痕优雅降级）。
- goal 自动续轮重启后保持 disarm，插件唤醒能让 agent 干活但不能替它 rearm goal（引擎要求人工确认）。
- 中断瞬间的模型流无法断点续流；后台命令 job 进程不可复活，只能语义重发。

---

## 2026-08-29 · dsh-self-restart 自动发现自激环（v0.3.4 业务门）

### 问题现象
任务早已闭环的会话在重启后被反复唤醒"自检恢复点"：同一会话（6118a91c）15 分钟内三连发【系统重启·自动发现】，账本里同批 4+ 会话各领一条空转唤醒。用户拍板判词："纯属多余和浪费"。

### 根因（两个齿轮咬合成环）
1. **判据只看 mtime**：源2 登记条件=会话日志 `session.jsonl.zstd` mtime 在 15 分钟窗口内。但唤醒后的**自检回复本身写日志**→ mtime 刷新 → 下次重启再命中。
2. **去重只看 pending**：`alreadyPending` 取 `pendingTasks()`（过滤条件含 `!resumedAt`），已唤醒过的任务**脱离去重视野** → 每次 scan 给同一会话登记全新任务。
   放大器：agent-running 信号同样会被自检 turn 命中（唤醒时进程正跑着自检）。

### 修复（v0.3.4 业务门）
登记判据 = 「**上次自动唤醒（resumedAt 水位线）之后有新的业务输入**」。业务输入=会话日志最后一条真 `user/message`，排除一切系统自注入：`source.plugin==='dsh-self-restart'`（唤醒消息）、`form==='instructions'`（dsh-mnemon 等伴随指令）、`Current runtime context`/`This is an automatically generated checkpoint` 文本前缀（上下文快照/压缩摘要）。`wake >= biz` → 丢弃；日志不可读/软 Deadline 6s → 保守放行（宁可误醒不可漏醒）；`verifyBusinessActivity:false` 一键回退。真人一发消息即解除封锁（biz 刷新 > wake）。

### 最快诊断法（本次一发命中）
会话日志 dump `user/message` 原始 JSON 看 `data.source.kind`：`'user'`=真人 vs `'plugin'`=注入（形态 2026-08-29 实证）；账本 tasks.json 看同批 `resumedAt` 与 `createdAt` 的连环模式（每次重启一批新 id、老 id 带 resumedAt 仍复发=去重漏）。真实数据单测 `test-gate.mjs`（导入导出的判据函数跑全量活跃会话，kept/dropped 语义人工复核）。

### 已知边界
- 判据不排除其他插件的真实任务消息（debate followup 等算业务）——方向正确的保守。
- 从未有业务输入的纯系统会话（biz=null→0 且 wake=0）不登记——无人在等它，符合预期。
- 大会话日志（数十 MB 解压）同步成本受 6s Deadline 截断，超时后剩余候选放行。

---

## 2026-08-31 · pwsh `$home` 变量名撞 `$HOME` 只读变量 → 递归删除整个家目录（灾难级）

### 问题现象
做「多租户 DSH 托管」M0 验证时，写了一条 pwsh 脚本准备在独立临时 home 里拉第二个 DSH 实例做隔离实测。命令跑完后：DSH 工作区对话列表全空、模型配置全消失、技能全没、全局 AGENTS.md 没了、Mnemon 记忆/文档被清空。

### 根因（一条命令链引发的灾难）
脚本第 3 行 `$home = Join-Path $env:TEMP "dsh-child-test-home"` —— 变量名 `$home` 与 PowerShell **只读自动变量 `$HOME`**（= `C:\Users\73618` 家目录）大小写不敏感、同名冲突，赋值抛 "Cannot overwrite variable HOME because it is read-only or constant" 且 `$home` 保持为家目录值。
因脚本顶部 `$ErrorActionPreference='Continue'`，报错后继续执行下一行 `Remove-Item $home -Recurse -Force -SilentlyContinue` —— **实际 = `Remove-Item C:\Users\73618 -Recurse -Force`**，递归删除整个家目录，直到 60s 工具超时强杀（`[timed out after 60000ms] [exit code:1]`）。

### 损失与侥幸存活（精确盘点）
- **侥幸存活**：26 个会话日志 `session.jsonl.zstd`（被运行中 DSH 进程锁定 → 删除失败）；D 盘所有项目；profiles 405MB。
- **真丢了/被重置**：`.dsh\skills\`（全部技能）、`.dsh\AGENTS.md`、Mnemon 运行时记忆 + 法律世界文档账本、`.dsh\settings.yaml`（模型配置被重置）、`.dsh\.credentials.yaml`（只剩 deepseek 1 个 key）。

### 修复
① 会话列表：文件健在（check_health ok=26 FAIL=0），重启 DSH 重扫即恢复；② 重建全局 AGENTS.md（含新增第 10 节变量名红线）；③ 本 LESSONS 条目；④ settings.yaml/credentials/技能/记忆按来源重建（qwen 等 key 需用户重提供）。

### 最快诊断法（5 分钟定位同类事故）
1. 先 `node D:\dsh\技术问题解决\check_health.mjs` —— 若 `FAIL=0` 说明会话日志根本没坏，"列表空"是前端/进程状态问题而非数据丢失。
2. 读事故会话日志尾部 `tool/call`/`tool/result`：`scanZstdFrames` 解压后 grep `Remove-Item|Recurse|$home|timed out` 即可锁到那条危险命令原文（铁证）。
3. 对照"哪些目录还在/没了"反推删除进程走到哪、被什么打断（锁定文件会 SilentContinue 跳过）。

### 铁律（已同步进全局 AGENTS.md 第 10 节）
pwsh 临时变量禁用 `$home`/`$pid`/`$host`/`$args`/`$input` 等自动/只读名；任何 `Remove-Item -Recurse -Force` 前必须打印目标路径并肉眼确认非系统/家目录，加白名单守卫。
