# dsh-multi-role-debate（聚合包）

这是**多角色并行论证 + 单 Agent 直接对话 + DSH Judge 汇总 + 结果回对话**的 DSH 聚合插件包。它是一个"一次性安装"入口：本身只提供 `cordis.patch.yml`（注册 3 个组件 bundle），并依赖下面 3 个组件包：

| 组件包 | 作用 |
|---|---|
| `dsh-codex-agent` | host 实体：长驻真实 `codex app-server`，提供 codexAgent 服务 |
| `dsh-claude-agent` | host 实体：长驻真实 `claude-agent-sdk`，提供 claudeAgent 服务 |
| `multi-role-debate` | 编排 + 前端：多角色论证 / 对话流触发 / DSH 汇总 / 结果回对话 / 直接对话 UI |

安装**本聚合包**，上面 3 个组件会一起注册、一起生效（见仓库根 [`README.md`](../README.md) 的安装步骤）。

## 前置依赖
- DSH（DeepSeek Harness）web profile。
- 本机已安装 **Codex CLI**（`@openai/codex`）与 **Claude Agent SDK**（`@anthropic-ai/claude-agent-sdk`）——本插件是围绕这两个真实 CLI 的薄封装，不内置二进制。
