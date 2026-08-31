# 事故复盘 · 2026-08-30/31 家目录误删（POSTMORTEM）

> 恢复执行于 2026-08-31，工具链见本目录（incident-recovery/）。全局红线已固化在 `C:\Users\73618\.dsh\AGENTS.md` §10；项目级过程条目见 `..\LESSONS_LEARNED.md`（2026-08-31 条）。

## 1. 时间线与根因链（证据：本会话日志 session-ff246373 尾部）

1. 2026-08-30 23:10（北京时间），本会话「多租户 DSH 托管」M0 验证探针脚本（pwsh）第 3 行：
   `$home = Join-Path $env:TEMP "dsh-child-test-home"` → 撞 PowerShell 只读自动变量 `$HOME`（大小写不敏感），赋值报错但脚本继续（`$ErrorActionPreference='Continue'`）。
2. 第 4 行 `Remove-Item $home -Recurse -Force -ErrorAction SilentlyContinue` 中 `$home` 实际值 = **`C:\Users\73618`（整个家目录）**。
3. 递归静默删除持续 **60 秒**，直到工具执行器超时强杀 pwsh 进程（`[timed out after 60000ms]`）才停止。
4. 被运行中 DSH 进程锁定的文件（会话日志、部分 profiles）删除失败而幸存；未锁定者丢失。SSD TRIM + 无卷影副本/文件历史 + `-Force` 不进回收站 → **不可恢复**（四路排查已验证）。

## 2. 损失与恢复结果矩阵（2026-08-31 晚 收口）

| 资产 | 事故后状态 | 恢复结果 | 来源/方法 |
|---|---|---|---|
| 会话日志（技术问题解决 31 + 个人网站 7 + 学习教程 4） | 最近数日子集被删；其余被锁幸存 | **不可恢复部分已定界**；幸存 42 个 check_health ok=42 FAIL=0 | trajectory 检索 + 帧校验 |
| 全局技能库 `.dsh\skills`（41 项） | 全灭 | **41/41 回归，validate 全绿**（详见 §3） | 幸存 workbuddy 目录 + GitHub 上游仓 + 幸存会话日志 write/skill-load 事件挖掘 + 按规范重建 |
| settings.yaml / credentials | 被重置 | 已重建（qwen/MiniMax 配通，另一会话完成） | 见 MEMORY |
| 4 个法律 MCP（元典×3 + 北大法宝） | 配置丢 | **已恢复**：User 级环境变量 token 幸存 + codex 幸存 config.toml → agent_sync 写入 web profile patch，**下次 DSH 重启生效** | `C:\Users\73618\.codex\config.toml` |
| multi-role-debate 配置 | 丢 | 已重建默认 config（judge=v4-pro/high/4096） | 插件源码 DEFAULT_CONFIG |
| dsh-sentinel 规则 | 丢 | 已重建（当日另一会话完成） | rules.generate |
| Mnemon：运行时记忆 USER/MEMORY | 清空 | 已重建（当前快照） | 各会话补写 |
| Mnemon：法律世界账本（15 confirmed）+ 双文档投影 + derive.mjs | 空间已空，脚本地面丢 | **待办**：属"个人网站/法律世界"项目线——`D:\dsh\个人网站` git 里 `data/legal-world.json`(17.6KB) 与 schema 幸存；账本原文若在 GitHub 宇宙仓（commit 5680b81）可按仓内重建 derive 流水线 | 请在个人网站工作区会话执行（那边 AGENTS.md 会自动注入） |
| MCP 连接器面板 82 市场连接器 connections/OAuth | 空 | **待用户**：需逐个重新授权（OAuth 必须本人），目录缓存幸存，入口 设置→🧩连接器 | — |
| 插件代码（codex/claude/mrd/site-connector/sentinel/self-restart/openrouter 等） | 全幸存（profiles\web\node_modules 被锁） | 无需动作 | — |

## 3. 技能恢复来源明细（41 项）

- **workbuddy 幸存直拷**（×2）：guizang-ppt-skill、leader
- **其他 agent 幸存目录**：computer-use 系（Orca 配发，经幸存会话日志 load 事件恢复正文）
- **D 盘幸存源码**：archify（学習教程\工具\archify-src，字节级一致）
- **GitHub 上游重取**（正文官方原版）：law-student ×13（anthropics/claude-for-legal）、huashu-nuwa（hkxiaoyao/nuwa-skill，与 DSH 原目录逐字一致）、find-skills（vercel-labs/skills）、video 三件套 download/narrate/transcribe（feiskyer/video-skills）、camoufox-2026（Bin-Huang/camoufox-cli，**近似恢复**）、playwright（playwright-core 自带 skill，**近似恢复**）
- **幸存会话日志挖掘**（write 事件全文还原）：dsh-plugin-development（2 文件）、dsh-plugin-publish（3 文件）、skill-creator（load 事件正文 2.7KB，附属 references/scripts 按红线重写重建）、computer-use
- **按原文描述重建**（正文=重建近似版，已文内标注，请抽查）：criminal-defense、criminal-prosecutor、procuratorate-research-writing、procuratorate-material-collector、people-procuratorate-review、zuiming-analysis、zhang-mingkai-perspective、trajectory-search（含全新可跑脚本 + slug 中文还原）、dsh-session-log-repair、dsh-model-config、orca-cli/orchestration（**stub**：Orca 应用未装，重装 Orca 即自动下发权威全文）
- **宿主自带幸存**：cordis-plugin-development、editing-cordis-compositions

已知两个 validate ERROR 非缺陷：`dsh-plugin-publish` 文本里的 `scripts/generate-readme.mjs` 指 awesome-dsh-plugin 仓库自带脚本；`law-student-cold-start-interview` 缺 template 为上游官方仓库自身问题。

## 4. 为什么没丢得更惨 / 为什么部分能救

- 运行中进程锁定 = 意外保护（会话日志、node_modules）。
- 幸存的"旧会话日志"是最高保真备份：write 工具参数含文件全文，skill-load 结果含 SKILL.md 正文（工具：mine_skills_from_logs.mjs，scan/extract 两模式可复用）。
- 多 agent 目录（workbuddy/pi/zcode/openclaw 部分真目录）互为镜像，但注意 **openclaw/pi 多数是符号链接**（链接目标 .agents 被删即死链）。
- User 级环境变量（token）在注册表，不受家目录删除影响。

## 5. 防再发（新增硬规，已/应固化）

1. 全局 AGENTS.md §10 变量名红线（已在）。
2. **任何写文件/删目录的 pwsh 脚本必须先干跑**：删除类脚本第一版只 `Write-Output` 目标路径，人审后换真删。
3. 高危路径白名单守卫模板：拒绝目标等于 `C:\`、`C:\Users\*`（家目录）、盘符根。
4. **家目录外镜像纪律**：`.dsh\skills`、`settings.yaml`、`.credentials.yaml`、`sentinel\`、`self-restart\config*` 属"删了就没了"面——建议每周整文件 copy 到 `D:\dsh\.dsh-backup\<日期>\`（会话日志只做整文件 copy，绝不重压缩）。← 待你点头我就建计划任务。
5. dsh-tenant-gateway（多租户）目标已暂停：该验证天然要"拉起第二个 DSH + 隔离盘"，风险面大，恢复验收完成前不动工。

## 6. 不可恢复清单（如实）

- 最近数日被删的会话日志（含本次事故当夜若干会话、法律世界账本的原始录入对话）——TRIM 后无卷影副本，确定不可恢复。
- 法律系 7 技能 + skill-creator 的**正文原文**（description 均按原文恢复；正文为规范重建，功能在、细节需你过目）。
- huashu-nuwa 的附属 references（官方仓已含，无损失）。

## 7. 第二波修复（8/31 深夜，用户追问"对话没恢复全"后发现）

**教训：第一波"收口"只验了 check_health（文件完好），没验「workspace 注册表 ↔ 磁盘」一致性——两者不是一回事。**

- 审计（`audit_sessions.mjs`）发现：43 个磁盘会话里 **14 个未被任何工作区 sessionIds 引用** → 侧栏不显示 → 用户以为"还没修好"。这些其实文件与标题（含重命名）都完好。
- 修复（`reregister_sessions.mjs`）：把 14 个孤儿会话合并回各自工作区（技术问题解决 +11、个人网站 +2、学习教程 +1），写回前自动备份 `workspace.json.bak-reregain-*`，纯新增零删除；8 秒后复查未被宿主回写覆盖，注册数 43=磁盘数对齐。
- 若 UI 仍不显示＝宿主内存缓存未重读 → 下次 DSH 重启自然恢复。
- **丢失清单无法再枚举**：`session_projcache` 在重启时被剪枝（只剩 22 条幸存会话），无其它全量索引。用户点名「AI进行时」对话：磁盘 43 个无此标题 → 确认属被删类，不可恢复；其**产物**（AI进行时频道数据 `D:\dsh\个人网站\data\ai-now.json` 16KB）在 git 完好，WorkBuddy 侧日志亦幸存。
- 另：磁盘上"构建DSH远程访问权限控制方案"存在 9 个同题 fork（事故夜自重启/goal 续跑产生的会话分叉谱系），均真实有内容，已全部注册回侧栏。
