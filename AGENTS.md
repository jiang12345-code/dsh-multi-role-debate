# AGENTS.md — 多角色辩论系统（multi-role-debate）项目记忆

本文件由 DSH 自动注入，是"新会话知道这个项目"的唯一可靠途径。改动代码前先读此文件；跨会话别丢的事实同步更新到这里。

> ⚠️ **遇到 bug / 异常行为时，第一动作（两条铁律）**：① 读 [`LESSONS_LEARNED.md`](LESSONS_LEARNED.md)（踩坑 SSOT）；② **检索历史会话轨迹**（`scan_discover` 或 `session.list` + 关键词，比如 `error`/`404`/插件名）——这次"面板空白"的完整失败与修复过程就在历史轨迹里，翻 5 分钟省 3 小时。修完非平凡 bug 必须回写 LESSONS_LEARNED.md 一条（现象/根因/修复/最快诊断法）。

## 一句话定位
在 DeepSeek Harness（DSH）里跑一套**多角色并行论证 + 单 Agent 直接对话**系统：Codex 与 Claude 真实 CLi 并行论证，DSH 主会话模型（Judge）做第三方汇总并回对话，另有 Obsidian 式单 Agent 直接对话。

## ✅ 本次已完成（里程碑 · 均已实测/验证）
- **能力1（多角色并行论证）**：① tab 按钮触发 + **主对话流触发**（发"多角色论证/辩论/开始论证 X"自动起辩论；`session/event` 监听，跳过插件消息防二次触发）；② 三栏实时流（Codex/Claude 流式 + DSH Judge 汇总，`pull()` 增量在 host `snapshot()` 累加成全文）；③ **DSH 汇总由 Judge 模型生成**（`llm.stream`，独立强模型，失败回退当前模型→兜底）；④ **结果回对话**（`agent.followup()` 喂给主会话自动呈现，turn 安全不污染日志）。
- **能力2（单 Agent 直接对话）**：Obsidian 式，点选 Codex/Claude；权限弹窗（Read Only 工作区 / Full access 完全，restricted/full 两档，点击外部关闭）。
- **UI 模型配置面板**（⚙ 弹窗）：Judge 下拉（deepseek-v4-pro/flash/flash-vision，动态列出）+ 推理档 + maxTokens；Codex/Claude 模型自由填；保存持久化到 `~/.dsh/profiles/web/multi-role-debate.config.json`（`config.get/set/listJudgeModels`）。
- **模型路由**：Judge→synthesizeWithLlm 用配置；Claude→SDK `options.model`（生效）；Codex→thread/start 带 model 失败回退不带（best-effort，绝不破坏）。
- **UI 按外部设计师稿复刻**：GitHub Dark 主题（#0d1117/#161b22/#1c2128/#30363d + 蓝绿黄紫），DM Sans + JetBrains Mono，手写 CSS + `React.createElement`（无 JSX/Tailwind），lucide 风格內嵌 SVG/emoji。
- **项目记忆固化**：本 AGENTS.md（新会话自动注入，防失忆）。
- 会话日志健康：`check_health.mjs` 基线 `ok=35 FAIL=0`。

## 📦 分发/分享（可安装复用）
- 仓库：**https://github.com/jiang12345-code/dsh-multi-role-debate**（PUBLIC，topic `dsh-plugin` 等 8 个，tag `v1.0.0`，**11+ commits，CI 通过**）。
- **npm 已发布 4 包**：`dsh-codex-agent@0.1.0` / `dsh-claude-agent@0.1.0` / `multi-role-debate@0.2.0` / `dsh-multi-role-debate@1.0.0`（`registry.npmjs.org`，均可安装；聚合包依赖版本化的组件包）。
- ✅ **awesome-dsh-plugin 市场收录 PR #3605 已提待合并**（`dsh-multi-role-debate`，2026-08-28）：Submission gate 本地+GitHub CI 双验证通过（point at aggregator subpackage `tree/main/dsh-multi-role-debate` + file slug `--dsh-multi-role-debate`；首次指根仓被门禁拒 "the root package.json declares no dsh.bundle"）。`dsh-openrouter-free` 市场 PR 仍因 commit 数 1 < 10 门槛未达标，等后续真实增量补足。
- **dsh-openrouter-free 已发布 v0.2.2**（用户已验收）：GitHub **https://github.com/jiang12345-code/dsh-openrouter-free**（PUBLIC，topics 含 dsh-plugin，tag **v0.2.2**，CI ✅ main@cf218f2）+ npm **dsh-openrouter-free@0.2.2**（维护者 jiangsan；`npm view` 实测返回 0.2.2）。源码以 `D:\dsh\技术问题解决\dsh-openrouter-free\` 为独立 git 仓（发布版 bundle manifest 齐）。版本线：v0.2.0 首发 → v0.2.1 凭据面板+推理档预校验 → v0.2.2 会话级双写修复（改走 `sessionController.selectModel`，幻影 API 根因见 LESSONS/AGENTS 架构条）。⏳ 市场 PR 材料已备（`market-prep\jiang12345-code__dsh-openrouter-free.yml`），**仍不提交**：门槛=仓库≥1天 + ≥10 commits，当前 **3 commits**（db7493d/dc83a21/cf218f2），需真实增量补足后再提。
- 本工作区是 **Git monorepo**：3 组件包 + 聚合包 + 根 `README`/`package.json`/`LICENSE`/`AGENTS.md`/`CHANGELOG.md`/`CONTRIBUTING.md` + 一键安装 `install.ps1` + `docs/`（演示截图+示例配置+安装指南）+ `.github/workflows/ci.yml`。npm/market 预备用 `docs/market-*.prep.*` 已 gitignore。
- **聚合包** `dsh-multi-role-debate`：`cordis.patch.yml` 插入 3 组件行（实体在前）。依赖已从 `file:` 改为**版本化** `^0.1.0`/`^0.2.0`（npm 发布需要；workspaces 亦按名解析本地）。
- 安装（用户侧）：clone → `pwsh install.ps1 -Profile web` → 重启 DSH。**前置依赖**：本机需已装 Codex CLI + Claude Agent SDK。
- ⚠️ 分发信任级验证：**聚合包组合已验证（闭环）**（`dsh --profile mrd-test --dump-config` 组合出 3 行 count=3）；**且已在用户自己的 DSH 以聚合插件形态真实运行**（辩论 tab 正常、`config.get` ok、`check_health` ok=50 FAIL=0）。

## 架构与目录（D:\dsh\技术问题解决）
三个独立 npm 插件包（用户选定架构 A：利于维护）：
- `dsh-codex-agent\`  — host-only 实体，长驻 `codex app-server --stdio`（JSON-RPC 2.0）进程。
- `dsh-claude-agent\` — host-only 实体，长驻 `claude-agent-sdk` query()。
- `multi-role-debate\`  — 编排 + 前端（`inject:['webServer']`，`ctx.get('codexAgent'/'claudeAgent')` 取两实体；`lib/index.js` = host，`lib/client.js` = conversation.view slot UI）。
- `dsh-openrouter-free\` — OpenRouter 免费模型面板（2026-08 新增，已部署进 profile bundles）：host 拉取 `openrouter.ai/api/v1/models` 过滤免费（pricing.prompt==='0'&&completion==='0'），经 `ctx.settings` 写 `llm-pi-ai.providers.openrouter.models`（保留手工条目）+ `agent-default-model` 整节替换；client = 「免费模型」slot 标签页一键切换。API 前缀 `/__orfree/api`。**关键机制**：llm-pi-ai 的 settings 分节更新后下一次请求即生效、无需重启；不支持推理的模型切换时必须摘掉 reasoningEffort（否则 UNSUPPORTED_REASONING_EFFORT）。**会话级切模型契约（v0.2.2 · 2026-09-03）**：对有请求历史的会话只改全局默认无效（三层优先级 pending→lastUsed→default），必须 `ctx.get('sessionController').selectModel({sessionId,provider,model,reasoningEffort?})`——原生选择器同一公开方法，内部含冷会话 resume + resolveCallConfig 校验 + `model/selection` 事件双写 + saveSelection；**公开 `agents` 服务（AgentRegistry）没有 `selectForNextRequest`，调它=幻影 API 静默降级**（问题一根因，见 LESSONS）。client 取 sessionId 用 `props.sessionId`（ui-session 标准 kit 注入，已验证可用）；model.use 响应带 `sessionApplied/note/sessionIdSeen` 三字段自证断点层。
- `dsh-self-restart\` — 自助重启插件 **v0.3.3**（已部署进 profile bundles）：host 固化「schtasks /RL HIGHEST 一次性任务 → taskkill /F/T 树杀 3080 监听进程树 → 端口释放确认 → Start-ScheduledTask dsh-web-service → 存活探测」，宿主非提权自动降级 WMI 分离 spawn；client 每 4s ping，连续 2 次失败全屏遮罩、恢复自动 reload。**v0.3.x 零登记自动续跑**：`schedule` 时自动扫三路信号（`agents.list()` running + 会话日志 mtime 活跃窗口 + `jobs.list()` running）写账本 `tasks.json`（`source:'auto-scan'`）→ 重启后开机 8s 错峰（默认 8s）自动续跑，手动 task 优先且不限量，auto 受 `maxAutoResume`(5) 上限；`resumeVia: live|materialized` 可观测。**两条引擎铁律（血泪，详见 LESSONS 2026-08-29 条）**：① `agent.followup()` 必须传规范 UserMessage（id/role/content/source:{kind:'plugin',plugin}）——纯字符串无 source 会让 RuntimeContextProjection 崩掉刚拉起的 turn；② 唤醒未加载会话须 `agents.resume({resumeSessionId:裸uuid, agentOptions:{provider,model}})`（model 取 `agentDefaultModel.currentSelection()`，缺了 persona `{{model}}` 组装即崩）。API：ping/status/schedule/scan(干跑发现)/wake(手动续跑)/task.add/task.done/task.list。配置 `~/.dsh/self-restart/config.json`（autoResume/activeWindowMs/maxAutoRegister/maxAutoResume/staggerMs/excludeSessions），账本 `tasks.json`，日志 `restart.log`。**agent 触发重启**：`Invoke-RestMethod http://127.0.0.1:3080/__dsh-restart/api -Method Post -ContentType 'application/json' -Body '{"method":"schedule","args":{"delayMs":15000,"reason":"..."}}'`（登记任务已自动化，agent 可不再手动 task.add，但精确交接仍推荐）。⚠️ 安全双坑：① 杀提权 DSH 须提权计划任务或同用户直接树杀/WMI；② host-auth 只包 `/api`，自定义前缀自建 loopback 围栏。⚠️ 已知边界：裸 uuid 旧格式会话 materialize 可能抛 inactive context（疑子代理会话，优雅降级留账本）；goal 自动续轮重启后需人工 resume。
- **⚠️ 续跑丢工具根因（2026-09-03 查实 · 部署态实为 v0.4.0，上方"v0.3.3"是旧标注）**：会话被唤醒后**有没有 terminal/filesystem 工具，取决于走哪条通道**。v0.4.0 主通道 `apiProxy.sessions.prompt`（"完整预设"）在 **alpha 线是死代码**（`canPrompt=false`，账本 `resumeVia` 只见 `live`/`materialized`、从无 `prompt`）→ 回落旧路径。旧路径两分支：① `via=live`（web 客户端已开着该会话，agent 在注册表）→ 只 followup、沿用原完整预设 → **工具在**；② `via=materialized`（`agents.resume` 冷激活、只传 `agentOptions:{provider,model}`）→ 用最小/默认预设挂载、**不含 terminal/filesystem provider → 工具没**（插件工具 mnemon/mcp/agent-sync 由插件注册故仍在，正好当判据）。"间歇性"＝重启后是客户端先重连(live)还是 8s 自动续跑抢先 materialize。**技能修不了**（只注入文本、不能加工具 provider）；dsh-self-restart 只是唤醒触发点，真正杠杆=让 materialize 也恢复完整预设（给 `agents.resume` 传 preset，或等 alpha 线 apiProxy prompt 通道可用）。**即时缓解（已多次实测有效）**：遇 `unknown tool pwsh` 别反复重试、也别让用户 DevTools 抓包——**从侧栏点开该会话**（走 live/完整预设＝带工具）即可继续。根治属 v0.5.0 待办（另见 Mnemon 文档 78caf2f7 P0 + MEMORY 同名条）。
- `dsh-site-connector\` — MCP/Skills 统一连接器面板（2026-08-28 新增，web+headless 双 profile bundles）：**聚合壳**，host 唯一端点 `/site-connector/api`（POST {method}）透传 fanout 到 dsh-agent-sync（scan/sync/status）+ dsh-mcp-connector（catalog/status/connect），**不自实现 MCP 协议/OAuth**；client = 设置侧「🧩 连接器」面板（GitHub Dark，统计卡+分类+搜索+卡片网格 4 触点）。源码 `D:\dsh\技术问题解决\dsh-site-connector\`，以 `file:` 依赖装进两 profile 的 node_modules + bundles。上游依赖：`dsh-mcp-connector@0.2.25`（npm，企查查 83 连接器市场）+ `dsh-agent-sync`（github:kuaiyukuaikuai/dsh-agent-sync，扫 20+ 本机 agent）。**首次部署把 DSH 前端打挂过（client 三违规）+ 路由静默缺席（host 三层坑）**——client 三铁律与 host 路由契约（ctx.inject 回调参数是 ctx 不是 service、prefix 须同注 webRuntime、apply 时刻 webServer 未就绪必须响应式注入）完整记录在项目 LESSONS L28；host 留有启动探针写 `~/.dsh/site-connector-boot.log`（3 行/次启动，稳定后可删）。
- **入口唯一化（2026-08-28 用户拍板）**：「MCP连接器」唯一入口 = **设置 → 🧩 连接器**（dsh-site-connector 注册的 settings.section）。① dsh-mcp-connector 左侧栏入口已停用（就地补丁：profile client.js 的 `sidebar.footer.action` 注入包进 `if(false)`；patch-package 与 pnpm 布局不兼容故未用，升级 dsh-mcp-connector 后侧栏入口若复现 → 跑 `D:\dsh\技术问题解决\reapply-mcp-connector-patch.ps1` 重打）；② dsh-site-shell 三态菜单的「🧩 链接器 (MCP)」按钮及 overlay 整链已删（源码层删除，非补丁）。

## 部署形态（重要 · 运行期生效对象）
- 源码在 `D:\dsh\技术问题解决\<包>\lib\{index,client}.js`。
- **运行期是 profile 里的副本**：`C:\Users\73618\.dsh\profiles\web\node_modules\<包>\lib\{index,client}.js`。改源码后必须 `Copy-Item` 到 profile 才生效。
- bundle 清单：`C:\Users\73618\.dsh\profiles\web\package.json` → `dsh.profile.bundles`。顺序：`…, dsh-codex-agent, dsh-claude-agent, multi-role-debate, dsh-mnemon`（**实体必须在编排前面**）。
- 模型配置持久化：`C:\Users\73618\.dsh\profiles\web\multi-role-debate.config.json`（`multi-role-debate\lib\index.js` 的 `DEFAULT_CONFIG`/`loadConfig`/`saveConfig` 读写；默认 judge=deepseek-official/deepseek-v4-pro/high/4096，codex/claudeModel 留空=各自默认）。

## 关键能力与 API（/__dsh-mrd/api，POST JSON {method,args}）
- 能力1 多角色论证：`role.start`（或**对话流触发**：主对话发"多角色论证/多角色辩论/开始论证 X"，`session/event` 监听自动起辩论）、`role.pull`（三栏流）、`role.synthesize`（DSH 汇总+回对话）。
- 能力2 直接对话：`role.chat({agent,message,chatKey,cwd,permissionMode,model})`。
- 模型配置：`config.get` / `config.set({config})` / `config.listJudgeModels`（Judge 下拉用）。

## 常用命令
- 语法检查：`node --check "D:\dsh\技术问题解决\<包>\lib\index.js"`
- 部署：`Copy-Item <源码> "C:\Users\73618\.dsh\profiles\web\node_modules\<包>\lib\" -Force`
- host 改动必须**重启 DSH**（host 跑进程内）；client 改动**硬刷新**即生效（module loader 从磁盘读）。
- 会话日志健康：`node "D:\dsh\技术问题解决\check_health.mjs"`（基线 `ok=32 FAIL=0`）。
- CLI 探针：codex `node <@openai/codex/bin/codex.js> app-server --stdio`；claude `claude -p --output-format stream-json --verbose`。

## 跨会话别丢的已知坑（血泪）
1. **增量拉取 ≠ 全文**：`codex/claude.pull()` 只返回自上次拉取的增量并推进 cursor。直接透传会导致正文只显示碎段。必须在 host `snapshot()` 里把增量累加成 `state.codexText/claudeText` 再返回。
2. **不能直接往主会话 `session.append` 一条 turn+assistant/message**：agent loop 空闲时内存缓存 `phase.lastTurn` 不会重读日志，注入后下次真实 turn 会撞号污染会话日志。**必须用 `agent.followup(message)`**（主会话自己算 turn 号 + 自动唤醒）来"结果回对话"。
3. **`session/event` 触发器必须跳过本插件注入的消息**（`source.kind==='plugin' && source.plugin==='multi-role-debate'`）："结果回对话"文本里含"多角色论证"会二次触发，覆盖真问题造成重复辩论。
4. **前端 CSS 必须 `document.createElement('style')`+`head.appendChild`**（`styles.insert` 全局不可用且静默失败）；**SVG 要显式 width/height**；容器要显式背景色防白底。
5. **router 用 `ctx.get('webServer').register({kind:'prefix',path,handler})`**，不能用 `harness.handle`（动态插件专属）。`subprocess.spawn` 必须带 `graceMs`+`argv` 数组；codex 走 `node <codex.js>`（npm .ps1 垫片不能 spawn）。
6. **模型路由**：Judge 经 `llm.stream`（provider/model 取自配置或 `agentDefaultModel.currentSelection()`），失败回退；codex model 是 best-effort（thread/start 带 model 失败回退不带，绝不破坏）；claude SDK `options.model`（生效）。
7. **UI 无 JSX/Tailwind**：手写 `React.createElement`；图标用內嵌 SVG/emoji。

## 会话日志安全红线（用户最高原则）
- 会话日志 `~/.dsh/sessions\<项目>\<session-id>\session.jsonl.zstd`，zstd 第 0 帧必须是恰好一行 header。**严禁**外部压缩工具重压；只会整文件复制。必须重排帧用 `deepseek-harness\reframe_session.ts`。遇到"刷新后对话消失"先跑 `check_health.mjs`。

## 🔥 2026-08-31 家目录误删事故与恢复（跨会话必读）
- 根因：本会话 M0 探针 pwsh 用 `$home` 撞只读自动变量 `$HOME` → `Remove-Item $home -Recurse` 删了家目录 60s。全链路复盘见 **`incident-recovery\POSTMORTEM.md`**（损失/恢复矩阵、来源明细、防再发）；红线固化在全局 `~/.dsh/AGENTS.md` §10。
- **技能库 41/41 已恢复**（`C:\Users\73618\.dsh\skills`，validate 全绿）：law-student×13 来自 anthropics/claude-for-legal、video 三件套 feiskyer/video-skills、huashu-nuwa/leader/guizang/archify 等各有其源；**法律系 7 个 + dsh-model-config/dsh-session-log-repair/trajectory-search/skill-creator 正文为重建版**（frontmatter 触发词=原文，正文近似重建，文中已标注，用到时请抽查校准）。
- 恢复工具链（可复用）：`incident-recovery\mine_skills_from_logs.mjs`（从幸存会话日志挖 write/skill-load 全文，scan/extract 两模式）+ `skill-creator\scripts\validate_skill.mjs`（全库校验）。
- 幸存会话 42 个日志全部健康（check_health ok=42 FAIL=0）；**最近数日被删的会话确认不可恢复**（TRIM/无卷影/不入回收站）。
- MCP：元典×3＋北大法宝已经 agent-sync 写进 web profile `cordis.patch.yml`，**下次重启 DSH 生效**（User 级环境变量 `YUANDIAN_API_KEY`/`PKULAW_MCP_TOKEN` 幸存）；82 个市场连接器仍需在 设置→🧩连接器 逐个重新 OAuth（用户本人）。
- multi-role-debate.config.json 已按默认重建；sentinel 规则当日已重建；**法律世界 Mnemon 账本(15条)+双文档投影+derive.mjs 丢失待恢复——在「个人网站」工作区会话做**（那边 AGENTS 自注入；`D:\dsh\个人网站\data\legal-world.json` 与 schema 在 git 幸存，GitHub 宇宙仓 5680b81 可对照）。
- **第二波修复（8/31 深夜）**：14 个"文件在盘但注册表掉关联"的会话（含 构建DSH远程访问权限控制方案×9 fork、配置千问套餐模型、模型配置技能询问 等重命名会话）已用 `incident-recovery\reregister_sessions.mjs` 重注册回各工作区（写回前自动备份 `workspace.json.bak-reregain-*`）。**丢失清单无法枚举**：`session_projcache` 在重启时被剪枝只剩幸存 22 条；用户点名的「AI进行时」对话文件已确认被删不可恢复，但其产物在个人网站 git（data/ai-now.json）与 WorkBuddy 日志幸存。若刷新侧栏未见恢复＝宿主内存缓存，择机 dsh-self-restart 重启即生效（本会话会自动续跑）。
- `dsh-tenant-gateway\`＝多租户托管项目（dsh-server-login MIT fork 基座），**M0 验证被事故打断、已暂停**；恢复该工作前重读 `incident-recovery\POSTMORTEM.md` §5（删除类脚本先干跑、白名单守卫、勿碰家目录）。

## 🔐 远程访问权限控制（2026-09-03 v2.2 · M1 账号体系已完成，M2 强制层进行中）
- 需求：**具名访客的工作区共享**——"给具体某个人只看我某几个工作区，设置面板便捷配置；我的工作区就是我的秘密"。分层：个人网站（www.jiangsan.vip，CF Pages）公开零拦截；DSH（harness.jiangsan.vip）登录后按 ACL 控权。
- **M1 已完成并 E2E 实测（2026-09-03）**：账号体系=注册(用户名+邮箱+密码,scrypt)→pending→owner 审批→按工作区 grant viewer→登录换 HMAC 会话 cookie（密钥持久化在 store meta，重启不掉线）→disable/remove 立即吊销旧 cookie。API 面：`POST /__share/api` {register|login|logout|me|status|users.list|pending.list|approve|reject|grant|ungrant|disable|enable|remove|owners.add|owners.remove|owner.create|enforce.get}；登录页 `GET /__share/auth`（loopback+公网均实测 200）。owner 账号=jiangsan（凭据存 `D:\dsh\dsh-owner-credentials.txt`，勿提交 git）。**enforce=false，插件只挂 /__share* 路由，手机/本机走原生门禁，access-check 4/4 全绿。**
- **M2 进行中（强制层改造）**：v0.2.0 的 enforce.js 是 CF 时代写的（按 CF JWT 判身份），需改造为按**账号会话**判身份：gate 判据（loopback=owner 直通 / 有效会话=按 ACL 放行+过滤 / 无会话远程=重定向登录页）+ 包 `connection.requestRejection/authorizeIndex` 绕行原生门禁 + session.list/history/search/attachment 按 header.cwd 过滤 + WS upgrade 握手鉴权。开启前置三条件：owner 手机登录实测 + break-glass 演练 + access-check 绿。
- 历史教训（勿重犯）：CF Access API 建 org 无登录方式（已放弃 CF）；强制层无 break-glass 会锁死 owner（见 LESSONS 2026-09-02）。M0 接缝结论：alpha.3 无官方多身份接缝，webServer 包装定案；安全不变量 I1-I10 全文在 `workspace-share-plan.md`（SSOT，v2.2）。
- 开工纪律：`dsh-plugin-development` 技能；bundle 插件 `inject:['webServer']` 硬依赖；重启守 `--trusted-host`/勿杀 cloudflared；每次部署后跑 `D:\dsh\dsh-access-check.ps1`；.ps1 带 BOM/纯 ASCII。

## 维护约定
- 本文件只写稳定事实与"去哪找"，不复制架构文档全文、不写明文敏感值。
- 会话结束时若新增跨会话事实，同步更新本文件。

