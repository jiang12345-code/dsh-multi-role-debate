# multi-role-debate

DeepSeek Harness 持久插件：多角色并行论证 + Obsidian 风格的单 agent 直接对话。

## 能力

- **多角色论证**：在 `conversation.view` 顶部常驻「多角色论证」tab。三栏（DSH 汇总 / Codex / Claude）并列，Codex + Claude 真实 CLI 并行流式追加；我（DSH 主会话）作为第三家独立厂商做 Judge + Aggregator。
- **直接对话**：同 tab 内可切到「直接对话」模式，点选 Codex 或 Claude，文本框直接发给对应 CLI（一问一答，逐段返回），不经 DSH 主代理。

## 安装（与官方 subagent provider 协同）

1. 装 host 半（已用过的 npm）：

   ```sh
   npx -p @deepseek-ai/dsh@0.0.1-rc.1 dsh plugin --profile web add D:\dsh\技术问题解决\multi-role-debate
   ```

2. （首次）重启 DSH：

   - 自动从 bundles 加载 `multi-role-debate`；
   - 顶部 `conversation.view` 多一个 tab「多角色论证」；
   - 触发词「多角色论证 / MoA / 多模型审查 / 三视角 / 三路并行 / 多角色审视 / 深度 MoA / 全面审视 / 交叉互评」匹配后由 DSH 主会话自动调用本插件。

## 怎么用

**多角色论证模式（默认 tab 视图）**：
- 输入问题 → 点「开始论证」→ 真 spawn `codex exec --json` + `claude -p --output-format stream-json` → 三栏逐 token 滚动 → 全部完成时「由 DSH 汇总」亮起 → DSH 主会话（我）拿三份综合。

**直接对话模式**（tab 顶部切到「直接对话」）：
- 选 Codex / Claude → 文本框 → Enter / 点「发送」→ 调对应 CLI，返回回答。
- 多轮在同一 tab 内累积。

## 端点（host JSON-RPC）

`POST /__dsh-mrd/api`  body: `{ "method": "...", "args": {...} }`

- `role.start({ question, mode })` — 开新论证；mode ∈ `standard`（默认，第一版仅此）/ `deep`（接口预留，暂未实现）
- `role.pull()` — 每角色 `{ status, totalLength, newText }`（newText = 自上次 pull 以来增量）
- `role.chat({ agent, message })` — 单 agent 直连，返回 `{ text }`
- `role.synthesize()` — 拉三份完整答案（给 DSH 主会话做 Judge / Aggregator）

## 数据格式

**Codex `--json`**（按行 JSONL）：
```
{"type":"thread.started","thread_id":"..."}
{"type":"turn.started"}
{"type":"item.completed","item":{"type":"reasoning","text":"..."}}
{"type":"item.completed","item":{"type":"agent_message","text":"..."}}
{"type":"turn.completed","usage":{...}}
```

**Claude `--output-format stream-json`**（按行 JSON）：
```
{"type":"assistant","message":{"content":[{"type":"thinking","thinking":"..."},{"type":"text","text":"..."}]}}
{"type":"result","subtype":"success","result":"...","usage":{...}}
```

## 与官方 subagent provider 的关系

本插件**不**走官方 `@deepseek-ai/dsh-subagent-codex` / `claude-code` 的 product 模式。
- 官方 provider：one-shot 返回 final answer，**不支持 host 侧真流订阅**
- 本插件：host 直接 `subprocess.spawn` + 解析 stream-json，**真流**（每行 event 立即 append 状态），client 轮询 180ms 拉增量

两者并存：官方 provider 用于工具面 `subagent_codex` / `subagent_claude_code`；本插件用于 tab 内的多角色论证 + 直接对话。

## 已知限制

- 第一版不做 prompt.sha256 缓存命中（接口预留，第一版总重跑）
- 第一版不做改写环（moa-review 的 Refinement Loop 暂不实现）
- 第一版不做"深度模式"的 Round 2 交叉互评
- 第一版不做 semantic cache / weighted consensus / decomposition / debate mode（moa-review/llm-council 21 features 中其余的）
- Client 用 `React.createElement` 手写 + `styles.insert` 注入 CSS（不走 tsdown/tailwind）；未来要升级到 NanmiCoder 完整形态需补 tsc + tsdown 构建链
- `client.js` 用 `window.__ModuleLoader__.load({id, factory})` 格式手写（与官方 `tsdown.client.ts` 产物一致）

## 升级路线

- 缓存命中：`$DSH_HOME/multi-role-debate/cache/<sha256>/` 存 `codex.jsonl` / `claude.jsonl`（已是 `role.start` 的占位点）
- 改写环：moa-review 风格在 Aggregator 之后
- 深度模式 Round 2：Codex/Claude 各看其他两路产出 + 修正自身
- 完整 tsdown + tsc 升级：把源码拆 host/client 两 program，匹配 `packages/client/tsdown.client.ts` 模板

## License

MIT
