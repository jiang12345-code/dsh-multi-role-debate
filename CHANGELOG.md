# Changelog

All notable changes to the multi-role debate DSH plugin.

## [1.0.0] - 2026-08-26
- Initial release of `dsh-multi-role-debate` (aggregator bundle) + the 3 component bundles:
  - `dsh-codex-agent` / `dsh-claude-agent` — host entities around the real Codex / Claude CLIs.
  - `multi-role-debate` — orchestration + front-end: multi-role argumentation, conversation-trigger, DSH Judge summary, result-back-to-conversation, single-agent direct chat, model config UI.
- `dsh-multi-role-debate` aggregate install package: `dsh.bundle.patch` registers the 3 component bundles in order (entities first, orchestration last).
- Distribution: Git monorepo + `install.ps1` one-click install + GitHub Actions CI (node --check + JSON validation).
- Added `repository` field to all packages for npm/dsh-market linkage.
