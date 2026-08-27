# Changelog

All notable changes to the multi-role debate DSH plugin.

## [1.1.0] - 2026-08-27
- **持久对话与记忆（直接对话修复）**：两个实体的会话/线程映射落盘（`~/.dsh/claude-agent/chat-sessions.json`、`~/.dsh/codex-agent/threads.json`），启动 hydrate、变更即写盘——刷新页面、重启 DSH 都能续接上下文；前端 chatKey 存 localStorage（按会话分桶）。
- **Claude 角色模型配置化**：面板可选 DSH 选择器同款模型（deepseek 全系）或 Claude 原生模型；DSH 系模型经 per-call env 覆盖（`ANTHROPIC_MODEL` + 三档 `DEFAULT_*`）生效，**Claude CLI 全部工具能力保留**（SDK 探针实证：init 模型=配置值 + Read 工具链真实调用）。
- **模型切换自动重开会话**：检测到生效模型变化时丢弃旧会话钥匙并插系统提示行（避免 resume 绑旧模型行为怪异）。
- **新增 host API**：`config.listDshModels`（枚举全部 DSH provider×model 供角色下拉）+ `config.get` 附 `codexDefaultModel`（读 `~/.codex/config.toml` 当前默认）。
- 配置入口按钮文案化：「⚙ 模型配置」（原裸齿轮不直观）。
- 版本：组件包 0.2.0 / 0.2.0 / 0.3.0，聚合包 1.1.0（依赖版本化同步）。

## [1.0.0] - 2026-08-26
- Initial release of `dsh-multi-role-debate` (aggregator bundle) + the 3 component bundles:
  - `dsh-codex-agent` / `dsh-claude-agent` — host entities around the real Codex / Claude CLIs.
  - `multi-role-debate` — orchestration + front-end: multi-role argumentation, conversation-trigger, DSH Judge summary, result-back-to-conversation, single-agent direct chat, model config UI.
- `dsh-multi-role-debate` aggregate install package: `dsh.bundle.patch` registers the 3 component bundles in order (entities first, orchestration last).
- Distribution: Git monorepo + `install.ps1` one-click install + GitHub Actions CI (node --check + JSON validation).
- Added `repository` field to all packages for npm/dsh-market linkage.
