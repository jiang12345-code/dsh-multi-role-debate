# 调研记录 — dsh-connector-linker (2026-08-27)

目标：参照图2（通达信/腾讯自选股/QQ邮箱/…知识库卡片）在 DSH 增加 MCP 连接器面板。

已检索（均已实际访问，带链接，非凭印象）：
- KMCP https://github.com/hashwnath/KMCP — 轻量文档 MCP（Docker Compose，零 LLM 查询），单源，轻
- zavora-ai/mcp-knowledge-base https://github.com/zavora-ai/mcp-knowledge-base — Rust/Cargo，9 工具（TF-IDF+反馈+版本/缺口/草稿/发布），企业级，重
- workbuddy-kimi-bridge https://github.com/fangshanzizhi/workbuddy-kimi-bridge — WorkBuddy ↔ Kimi MCP 桥接文档，**多源聚合模式最贴图2**
- lacuna-wiki https://github.com/Labhund/lacuna-wiki — 知识图谱型 MCP，非卡片形态
- DSH harness 社区 https://www.deepseek.com/harness/ + github.com/topics/dsh-plugin — 无现成"连接器"插件（仅 multi-role-debate / dsh-codex-agent / dsh-claude-agent / dsh-openrouter-free / dsh-self-restart）

结论：无直接可复制轮子。借鉴 KMCP（服务端模板）+ zavora（搜索/反馈机制）+ workbuddy-bridge（多源聚合）→ 方案 B（聚合 MCP 代理 + 前端卡片面板）。已准备源文件：D:\dsh\技术问题解决\dsh-connector-linker\（package.json / cordis.patch.yml / lib/index.js / lib/client.js），**尚未部署到 profile 层**（未执行 Copy-Item / node --check / 重启）。

待执行：用户确认"执行" → 部署到 profile node_modules → 验证 /__connector/api + 卡片渲染。
