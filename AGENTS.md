# AGENTS.md — 多角色辩论系统（multi-role-debate）项目记忆

本文件由 DSH 自动注入，是"新会话知道这个项目"的唯一可靠途径。改动代码前先读此文件；跨会话别丢的事实同步更新到这里。

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
- ⏳ **awesome-dsh-plugin 市场收录 PR 待提**（仓库满 1 天后，即 2026-08-27 上午）：fork awesome-dsh-plugin → 加 `data/plugins/jiang12345-code__dsh-multi-role-debate.yml`（category=workflow，en+zh 描述）+ `data/screenshots.json`（docs/ 三图）→ 重生成 README → 提 PR。
- 本工作区是 **Git monorepo**：3 组件包 + 聚合包 + 根 `README`/`package.json`/`LICENSE`/`AGENTS.md`/`CHANGELOG.md`/`CONTRIBUTING.md` + 一键安装 `install.ps1` + `docs/`（演示截图+示例配置+安装指南）+ `.github/workflows/ci.yml`。npm/market 预备用 `docs/market-*.prep.*` 已 gitignore。
- **聚合包** `dsh-multi-role-debate`：`cordis.patch.yml` 插入 3 组件行（实体在前）。依赖已从 `file:` 改为**版本化** `^0.1.0`/`^0.2.0`（npm 发布需要；workspaces 亦按名解析本地）。
- 安装（用户侧）：clone → `pwsh install.ps1 -Profile web` → 重启 DSH。**前置依赖**：本机需已装 Codex CLI + Claude Agent SDK。
- ⚠️ 分发信任级验证：**聚合包组合已验证（闭环）**（`dsh --profile mrd-test --dump-config` 组合出 3 行 count=3）；**且已在用户自己的 DSH 以聚合插件形态真实运行**（辩论 tab 正常、`config.get` ok、`check_health` ok=50 FAIL=0）。

## 架构与目录（D:\dsh\技术问题解决）
三个独立 npm 插件包（用户选定架构 A：利于维护）：
- `dsh-codex-agent\`  — host-only 实体，长驻 `codex app-server --stdio`（JSON-RPC 2.0）进程。
- `dsh-claude-agent\` — host-only 实体，长驻 `claude-agent-sdk` query()。
- `multi-role-debate\`  — 编排 + 前端（`inject:['webServer']`，`ctx.get('codexAgent'/'claudeAgent')` 取两实体；`lib/index.js` = host，`lib/client.js` = conversation.view slot UI）。

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

## 维护约定
- 本文件只写稳定事实与"去哪找"，不复制架构文档全文、不写明文敏感值。
- 会话结束时若新增跨会话事实，同步更新本文件。
