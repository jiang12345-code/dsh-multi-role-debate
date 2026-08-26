# 多角色并行论证 DSH 插件（multi-role-debate）

在 DeepSeek Harness 里跑一套**多角色并行论证 + 单 Agent 直接对话**系统：真实 **Codex** 与 **Claude** CLI 并行论证，**DSH 主会话模型（Judge）**做第三方汇总并回对话，另有 Obsidian 式单 Agent 直接对话。

> 一套能调用 codex/claude、实现多模型论证的实体功能。`dsh-multi-role-debate` 是**聚合安装包**：装它 = 装齐下面全部 3 个组件。

## 组成
| 包 | 作用 |
|---|---|
| `dsh-multi-role-debate`（本次新增，入口） | 聚合包：`cordis.patch.yml` 注册 3 个组件；依赖它们 |
| `dsh-codex-agent` | host 实体：长驻真实 `codex app-server`（JSON-RPC 2.0） |
| `dsh-claude-agent` | host 实体：长驻真实 `claude-agent-sdk` query() |
| `multi-role-debate` | 编排 + 前端：多角色论证 / 对话流触发 / DSH 汇总 / 结果回对话 / 直接对话 UI / 模型配置 |

## 能力
- **能力1 · 多角色并行论证**：tab 按钮或**主对话流触发**（发"多角色论证/辩论/开始论证 X"）→ Codex+Claude 并行流式 → DSH Judge（独立强模型）生成汇总 → `agent.followup()` 自动回对话呈现。
- **能力2 · 单 Agent 直接对话**：Obsidian 式点选 Codex/Claude，权限弹窗（Read Only / Full access）。
- **模型自由配置**：tab 顶栏 ⚙ 弹窗，Judge 下拉 + Codex/Claude 自由填，持久化。
- **UI**：GitHub Dark 主题，手写 CSS + `React.createElement`（无 JSX/Tailwind）。

## 前置依赖（重要）
- **DSH web profile**（`dsh web` 运行环境）。
- 本机已安装：
  - **Codex CLI** —— `@openai/codex`（`codex` 命令；spawn 走 `node <@openai/codex/bin/codex.js>`）
  - **Claude Agent SDK** —— `@anthropic-ai/claude-agent-sdk-win32-x64` / `claude` 命令
- 本插件是这两个真实 CLI 的**薄封装**，**不内置二进制**。

## 安装（用户侧）
1. 克隆本仓库（或拿到 `dsh-multi-role-debate` 目录）。
2. 在仓库根 `npm install`（workspaces 会把聚合包与 3 个组件一起装好；聚合包用 `file:../` 依赖本地组件）。
3. 把聚合包装进你的 DSH profile 并注册。以 web profile 为例：

```bash
# 在 profile 目录安装聚合包（会带进 3 个组件）
cd ~/.dsh/profiles/web
npm install /path/to/repo/dsh-multi-role-debate

# 把聚合包加进 dsh.profile.bundles（加在列表末尾，实体顺序由聚合包 patch 保证）
# 编辑 ~/.dsh/profiles/web/package.json，在 dsh.profile.bundles 追加 "dsh-multi-role-debate"
```

4. **重启 DSH**，在对话视图顶部出现"多角色论证" tab 即安装成功。

> 说明：聚合包 patch 会插入 `dsh-codex-agent`、`dsh-claude-agent`、`multi-role-debate` 三行；若你的 profile 之前已单独添加过它们，请去掉那 3 个旧条目，只保留聚合包一条，避免重复。

## 使用
- **tab（多角色论证）**：输入问题 → 开始论证；或切"直接对话"点选 Codex/Claude。
- **主对话流触发**：直接发"多角色论证：<问题>"。
- **配置模型**：顶栏 ⚙ → 选 Judge 模型 + 填 Codex/Claude 模型 → 保存。

## 已知坑 / 项目记忆
改写代码前先读本项目根 `AGENTS.md`（含 7 条血泪坑：`pull()` 增量累加、`agent.followup()` 回对话、触发器跳过插件消息、CSS/SVG、router/spawn、模型路由、无 JSX；以及会话日志安全红线）。

## License
MIT
