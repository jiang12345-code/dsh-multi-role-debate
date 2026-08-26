# Contributing / 贡献指南

Thank you for contributing to the multi-role debate DSH plugin.

## Dev setup
- Requires **DeepSeek Harness** web profile + the real **Codex CLI** (`@openai/codex`) + **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) installed on your machine. The plugin is a thin wrapper around these two CLIs and does **not** ship their binaries.
- This is a **Git monorepo**: `dsh-codex-agent`, `dsh-claude-agent`, `multi-role-debate` (components) + `dsh-multi-role-debate` (aggregate install bundle).

## Layout
| Path | Purpose |
|---|---|
| `dsh-codex-agent/lib/index.js` | Codex entity host (long-lived `codex app-server`) |
| `dsh-claude-agent/lib/index.js` | Claude entity host (long-lived `claude-agent-sdk`) |
| `multi-role-debate/lib/index.js` | Orchestration host (`/__dsh-mrd/api`, config, session-event trigger) |
| `multi-role-debate/lib/client.js` | `conversation.view` slot UI (hand-written `React.createElement`, no JSX) |
| `dsh-multi-role-debate/cordis.patch.yml` | Aggregate bundle patch (registers the 3 component bundles) |

## Editing + deploy
1. Edit source in the package `lib/`.
2. `node --check <file>` to verify syntax.
3. Copy to the running profile: `Copy-Item <src> "$HOME/.dsh/profiles/web/node_modules/<pkg>/lib/" -Force`.
4. **host** changes require a DSH **restart**; **client** changes only a hard refresh (module loader reads from disk).

## Before opening a PR
- Read the project `AGENTS.md` (auto-injected) — it holds the known pitfalls you must not regress (incremental `pull()` accumulation, `agent.followup()` for result-back, plugin-message skip in the trigger, etc.).
- Never recompress session logs (`~/.dsh/sessions/**/*.jsonl.zstd`) with external tools; they are frame-constrained. Use `reframe_session.ts` if a reframe is ever needed.

## License
MIT.
