# Install / 安装说明

> 前置依赖（必装）：本机需已装 **Codex CLI**（`@openai/codex`）与 **Claude Agent SDK**（`@anthropic-ai/claude-agent-sdk`）。本插件是这两个真实 CLI 的薄封装，不内置二进制。

## 方式一 · 一键脚本（Windows，推荐）
```powershell
# 在插件仓库根目录
pwsh install.ps1 -Profile web          # 安装到 web profile（用 -Profile <name> 换）
pwsh install.ps1 -Profile web --uninstall   # 撤销：恢复 3 个单独组件条
```
脚本会：把 `dsh-codex-agent` / `dsh-claude-agent` / `multi-role-debate` / `dsh-multi-role-debate` 复制进目标 profile 的 `node_modules`，并把 `dsh.profile.bundles` 里的 3 个单独条目换成聚合包一条。然后**重启 DSH**。

## 方式二 · 手工
1. 克隆仓库（或拿到 `dsh-multi-role-debate` 目录）。
2. 把 4 个包装进 profile：`cd ~/.dsh/profiles/web && npm install /path/to/repo/<包>`（或复制到 `node_modules`）。
3. 编辑 `~/.dsh/profiles/web/package.json`，在 `dsh.profile.bundles` 删掉旧的 3 条（`dsh-codex-agent`/`dsh-claude-agent`/`multi-role-debate`），追加 `"dsh-multi-role-debate"`。
4. **重启 DSH**；对话视图顶部出现「多角色论证」tab 即成功。

## 打包 / 发布（维护者用）
```bash
npm run pack      # 或对每个包 npm pack 生成可分发 tarball
npm publish       # 需先 npm adduser 登录（可选，仅影响市场下载量展示）
```

## 效果验证
- 辩论 tab 正常出现。
- `/__dsh-mrd/api`（`config.get`）返回配置。
- `dsh --profile web --dump-config` 组合出 `dsh-codex-agent`/`dsh-claude-agent`/`multi-role-debate` 三行。
- 会话日志健康：`node check_health.mjs` → `FAIL=0`。
