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

---

## 2026-09-02 · 手写 models 条目漏 reasoningEfforts → UI 智能挡位静默消失（glm-5.3-flash）

### 问题现象
zai-coding-cn/glm-5.3-flash 配通（chat 200、UI 下拉可见），但模型设置里**没有智能挡位选择**，且全程无任何报错。

### 根因
pi-ai `catalog.ts` 的 `resolveModelReasoning`：手声明模型条目 `reasoningEfforts` 缺省 = `reasoning: false` = UI 不显示挡位选择器。**静默失败**——且不继承内置 catalog 同名/同系模型的 reasoning 声明（glm-5.3-flash 不在内置 catalog，base=undefined）。配置时看到了官方文档"推荐 reasoning_effort: max"却没转成配置项。

### 修复
settings.yaml 该模型加 `reasoningEfforts: {low: low, medium: medium, high: high, max: max}`（映射经真实探针校准：实测 low→reasoning_tokens=0、max→962+，与官方"思考强制开启"描述不符，以探针为准）+ 重启 DSH。

### 最快诊断法
推理模型配完看 UI 有没有挡位选择器；没有 = 漏了 `reasoningEfforts`。挡位映射对不对，用 `reasoning_effort` 逐档实测读 `usage.completion_tokens_details.reasoning_tokens`。

### 防再发
已固化进 `dsh-model-config` 技能（Step 1 铁律 + Step 2 挡位探针 + Step 3 目检挡位，2026-09-02）。

---

## 2026-09-03 · dsh-openrouter-free 两大坑：面板切换对老会话无效 + MISSING_CREDENTIAL

### 问题现象
① 面板点选免费模型后，主对话底部模型选择器不跟（要再手动重选一遍才显示新模型）；② 切换后发消息报 `llm-pi-ai: no credential for provider route "openrouter": its profile resolves OPENROUTER_API_KEY, which is not set`（MISSING_CREDENTIAL）。

### 根因（两层，第二层藏在 alpha.2 引擎深处）
1. **MISSING_CREDENTIAL**：免费模型也要 OpenRouter API Key（$0 费用 ≠ 免认证）。插件只写了 settings 路由（`apiKeyEnv: OPENROUTER_API_KEY`），凭据库里从来没有这个键（8/31 事故重置 credentials 后也没重建过它）。请求前 llm-pi-ai 逐操作 resolve 凭据 → 缺失即拒。
2. **切换不跟**：插件 `model.use` 只写 `agent-default-model`（全局默认），但 alpha.2 会话模型选择是**三层优先级**（session-controller/agent.ts `selectionFor`）：会话 pending（`model/selection` 事件）→ **上次请求的 header**（有请求历史的会话锁死在 lastUsed）→ 全局默认。**只改默认对"有过请求历史的会话"完全无效**。原生选择器之所以一切就生效，是因为它走 `commands.selectModel` = `selectForNextRequest`（写会话级事件）+ `agentDefaultModel.saveSelection`（存默认）**双写**。

### 修复（v0.2.1）
- host `model.use({id, sessionId})`：① 先 `llm.resolveCallConfig` 预校验（坏模型在切换时报错而非发消息才炸）；② 带 sessionId 时 `agents.get(sessionId)` + `agents.selectForNextRequest(agent, selected)` 复刻原生双写；会话未加载降级仅改默认并在 note 里说明。**⚠️ ② 当日后续实测无效——`selectForNextRequest` 在公开 `agents` 服务上根本不存在（幻影 API），见下面"问题一收口"条目；真正修复 = 直调 `sessionController.selectModel`。**
- host 新增 `key.status/key.set/key.unset`：走 `ctx.get('credentials')` 服务的 `describe/set/unset`，把 key 写进凭据库（免重启，写入即广播 `credentials/reference-updated`，前端选择器自动刷新）。`/__orfree` 补 loopback 围栏（host-auth 只包 /api，自定义前缀自建围栏——site-connector 同款教训）。
- client：切换传 `props.sessionId`（session 级 slot 框架注入）；缺 key 时面板显示警示条 + password 输入框一键保存。

### 最快诊断法
1. 见到 `no credential for provider route "X"` → 直接查 `.credentials.yaml` refs 有没有对应键名（只列键不打印值）；有 `apiKeyEnv` 就必须配凭据，没有第三条路。
2. "切了模型不生效" → 先看会话有没有请求历史（9 轮 10 步那种必有 lastUsed 锁定）；alpha.2 引擎里全局默认只是第三优先级，修法是会话级双写，不是重启。
3. 会话模型选择三层优先级读 `packages/api/session-controller/src/agent.ts` 的 `selectionFor`（L271-298），`packages/api/session-controller/src/commands.ts` 的 `selectModel`（L118-154）是原生双写范本。

### 问题一收口（同日晚）· 第三个坑：幻影 API —— `agents.selectForNextRequest` 不存在

**现象**：v0.2.1 双写代码部署后行为不变：面板点模型只改全局默认，底部选择器对老会话不跟；curl 复现（`model.use` 带真实已加载 sessionId）返回 `sessionApplied:false, note:"agents 服务不可用，仅改全局默认"`——即 host 永远走不进会话分支。

**根因（H2 实锤，H1 排除）**：公开的 `ctx.get('agents')` 是 core/agent 的 **AgentRegistry**，方法只有 `get/list/roots/create/resume/register/enter/announce/isOwnedBy/withInitiator…`——**没有 `selectForNextRequest`**。它长在 session-controller 的**内部类** `ApiSessionAgentController`（`packages/api/session-controller/src/agent.ts` L321，SessionController 构造时 `new` 出来，不注册为任何服务）。所以 `typeof agents.selectForNextRequest === 'function'` 恒为假，会话级那一笔**从 v0.2.1 起就从未落地过**。H1（props.sessionId 为空）同时排除：ui-session 的 `BUILTIN_SOURCE` 把 `sessionId` 作为标准 kit prop 注入**所有 session 作用域 slot 组件**（`packages/client/ui-session/src/client/index.ts` L197-210），multi-role-debate 同款 `props.sessionId` 取法且生产验证可用。

**修复（v0.2.2）**：host `model.use` 会话级直调 **`ctx.get('sessionController').selectModel(Object.assign({sessionId}, selected))`** —— 这是底部原生选择器同一个公开方法（@Remote('selectModel')，host 侧就是普通类方法，动态插件 Inspect 目录可见），内部自动做：resolveAgent（**冷会话也 resume**，比旧代码只认活会话更强）→ `llm.resolveCallConfig` 校验 → `selectForNextRequest`（写 `model/selection` 会话事件 → 投影 pending → 底部选择器立即显示 + 内存 selection 供下次组装）→ `agentDefaultModel.saveSelection`（全局默认）。响应加 `sessionIdSeen` 自报字段，三种 note 分支各自定位（未收到 id / 服务不可用 / 写入失败），下次诊断零猜测。离线集成测试 `test-orfree-model-use.mjs` 五路径全过（A 应用成功 / B、C 服务缺席 / D selectModel 抛错 / E 无 sessionId）。

**max 推理档第三坑（同轮已修，一并记录）**：旧 `model.use` 给推理模型写 `reasoningEffort:'max'`，但 `mapModel` 生成的 llm-pi-ai 条目只声明 `reasoningEfforts:{low,medium,high}` → `resolveCallConfig` 拒 → 一路到发消息才炸 `UNSUPPORTED_REASONING_EFFORT`（项目 AGENTS 老坑的**真正根源**）。修法：**从高到低试 resolveCallConfig 自动挑该模型真正支持的一档；非推理模型整个省略 `reasoningEffort`**。与"手声明条目缺 `reasoningEfforts` = UI 挡位静默消失"互为镜像：**声明的档位集合与所选档必须两边一致**。

**最快诊断法（通用）**：
1. 插件报"服务不可用/方法不存在"降级时，**先列该服务的真实方法面**（动态插件 `cordis_inspect_query` Host `Service.listService` 不带参 = 全服务方法目录，或直接读类源码），别凭文档/印象调用——服务名对≠方法在。
2. "面板切了不跟"用一条 curl 断层：`POST /__orfree/api {"method":"model.use","args":{"id":"<免费模型>","sessionId":"<真实会话id>"}}` → `sessionApplied + note + sessionIdSeen` 三字段直接区分 前端没传 id / host 服务不可用 / 引擎写入失败 / 成功但 UI 未刷（真出现再查前端投影流）。会话 id 取自 `DSH_SESSION_ID` 环境变量（pwsh 里 `Get-ChildItem env:DSH_*`），格式 `session-<uuid>` 就是 agents/selectModel 认的键。
3. **验证"修复已生效"必须看响应/事件的实证**（`model/selection` 事件会追加进会话日志），代码"看着对"不等于接口存在——本次 v0.2.1 就是对着幻影 API 写了单测跑不通的"修复"。

---

## 2026-09-02 · CF Access API 建org无登录方式 + 强制层无 owner 应急通道 → 远程访问双锁死（dsh-workspace-share M0）

### 问题现象
为 harness.jiangsan.vip 用 CF API 建了 Zero Trust org + Access 应用 + allow-everyone 策略后，公网访问 302 到 CF 登录页，但页面上**没有任何登录方式**（"There are no login methods available for this account"）——本机（用域名访问）和手机全部进不去；随后部署的插件强制层又对无 CF JWT 的远程请求一律 401，删掉 CF 应用后**手机依然 401**（被自己的插件挡住）。

### 根因（两层叠加）
1. **API 创建的 Zero Trust org 不自带任何身份提供方**：策略里的 `auth_method:[{single_email_code:{}}]` 字段被接口静默忽略（响应不回显），OTP 登录方式从未生效 → CF 层死路。
2. **强制层没有 owner 应急通道（break-glass）**：v0.2.0 对所有非 loopback 请求要求 CF JWT，CF 一坏/一删，owner 自己的远程访问也被锁——设计时只想着"防访客"，没想"CF 挂了我怎么进门"。

### 修复（回滚）
① DELETE `access/apps/{id}`（拆 CF 墙）；② 从 profile `package.json` 的 bundles 数组摘除 `dsh-workspace-share`；③ 经 dsh-self-restart 重启。验收指纹：公网 401 响应体从我的 `authentication required` 变回原生 `dsh web authentication required; reopen…` = 强制层卸载干净；手机凭 30 天原生 cookie 恢复访问。

### 最快诊断法
公网 GET / 看响应体指纹区分三层门：`302→cloudflareaccess.com`=CF 墙；`authentication required`=workspace-share 强制层；`dsh web authentication required; reopen…`=DSH 原生 token 门禁（正常，浏览器有 30 天 cookie）。逐层剥洋葱定位是谁在挡。

### 铁律（已进计划文档"耐久性"节）
① 任何鉴权/门禁层上线前，必须先验证"登录方式真的存在"（真实浏览器走一遍），API 返回 success ≠ 登录方式生效；② 强制层必须有 owner break-glass（loopback 之外的应急进门方式或一键物理下线开关），否则不许部署。

---

## 2026-09-03 · 多角色论证"实体未就绪"+"直接对话失忆"三层根因（实体包消失 / codex 配置断 / saveThreads 哑火）

### 问题现象
① 辩论 tab 报 `[错误] 实体未就绪（dsh-codex-agent / dsh-claude-agent 未加载）`；② 修复重启后直接对话"记忆能力都没有了"；③ codex 通道换报 `failed to load configuration: 系统找不到指定的文件 (os error 2)`。

### 根因（三层独立，层层都真）
1. **实体包从 profile 消失**：`profiles\web\node_modules\` 里只剩编排层 `multi-role-debate`，`dsh-codex-agent`/`dsh-claude-agent` 两个包没了、bundles 里也没了这两行（9/1 升级或某次 profile 重装冲掉）。编排层 `ctx.get` 可选获取设计使 tab 界面正常、调用才报错——"界面在但一用就报错"= 实体缺席的指纹。
2. **codex CLI 自身配置断**：`~/.codex/config.toml` 第 5 行 `model_catalog_json = "cc-switch-model-catalog.json"` 指向的文件在 8/31 事故被删（cc-switch 只重建了 config.toml，catalog 文件没有）→ codex app-server 每次 load config 即抛 os error 2，JSON-RPC `-32600`。**这不是插件问题**。
3. **`saveThreads` 真代码 bug（GitHub 发布版同样带着）**：`dsh-codex-agent/lib/index.js` 用了 `path.dirname(...)`，但文件只 `import { dirname, join } from 'node:path'`——`path` 未定义 → ReferenceError 被 `catch { /* ignore */ }` 静默吞掉 → **threads.json 从上线起一次都没写过**。进程内 Map 记忆正常（暗号探针能过），跨 DSH 重启记忆全是假的。同文件 grep `path\.` 全仓扫一遍：只有这一个包踩雷（claude-agent/mrd 都正确 `import path from 'node:path'`）。
4. 附带哑雷：`multi-role-debate/lib/client.js` 513 行调用未定义的 `h(...)`（正确是 `React.createElement`）——因 host 尚未实现 `codexDefaultModel` 字段而暂不触发；一旦补上该字段，打开「模型配置」即崩整棵面板子树。已顺手修复。

### 修复
① 两实体包整目录复制回 profile node_modules + bundles 在编排层之前插入两行（改前备份 package.json）；② 删除 config.toml 失效的 `model_catalog_json` 行（备份 `.bak-mrd-fix`）；③ `path.dirname`→`dirname` + catch 改打错误日志，bump 0.2.1；④ `h(`→`React.createElement(`；⑤ 恢复验证：暗号两连发（BLUE-FALCON-77 种/取）codex、claude 双通道全通。

### 最快诊断法
1. **记忆探针一键分层**：同 chatKey 连发两条 role.chat（种暗号/索暗号）——都答对=进程内记忆在，问题只在跨重启持久层；第一条就报错=实体/CLI 层断，看 error 原文。
2. JSON-RPC `-32600 failed to load configuration (os error 2)` = **codex CLI 配置层**，先查 `~/.codex/config.toml` 引用的文件是否存在，别在插件里翻。
3. "落盘映射文件在不在"直接判持久层：`~/.dsh/codex-agent/threads.json` / `~/.dsh/claude-agent/chat-sessions.json`；写失败被静默吞 → 检查 catch 是否 `/* ignore */` + 所用标识符是否真的 import 了。
4. 前端组件嫌疑用 **playwright harness 隔离复现**：`/login` 页 origin + unpkg React UMD + `__ModuleLoader__` mock + eval 真实 client.js，按钮点击/控制台错误全真复现（本次隔离环境双向切换零报错=组件无罪，问题在真实 GUI 环境）。钩子 `React.createElement` 包一层可抓 "type is invalid (#130)" 的 undefined 元素。
5. dsh-host-auth 挡住 GUI 时：登录密钥=配置级 `cordis.patch.yml accessKeys`（明文）+ 页面 key（只存 SHA-256 摘要）；临时加一个配置 key 重启即进。`/__dsh-*` 自定义前缀路由不过 guard，curl 可直测 host API。

### 铁律
① `catch { /* ignore */ }` 必须附带最小证据输出（console.error 一行），纯静默吞会把"从未生效"伪装成"一直在工作"；② 用了 `path.xxx` 就必须 `import path from 'node:path'`，解构导入（`{dirname, join}`）时严禁混用；③ 每次动 profile（升级/重装/装插件）后，把 bundles 清单与 node_modules 对照 AGENTS 的"部署形态"节核一遍——实体在编排前。
