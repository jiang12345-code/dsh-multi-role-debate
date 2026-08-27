/**
 * dsh-claude-agent — Claude 实体 (host-only)
 *
 * 通过 @anthropic-ai/claude-agent-sdk 的 query() 驱动 Claude Code。
 * 增强：
 *   多轮记忆：第一轮 query({ options: { sessionId: <uuid>, persistSession: true } }) 新建，
 *             后续 query({ options: { resume: <uuid> } }) 续接。
 *   指定 cwd：query({ options: { cwd } }) 让实体在指定目录工作（默认 DSH 进程 cwd）。
 *
 * 暴露：
 *   chat(message, { sessionId, cwd })   — 能力 2 直接对话（可续接）
 *   startConversation(prompt, { cwd })  — 能力 1 编排（返回 convId，可 pull）
 *   pull(convId)                        — 返回增量
 *   dispose()                           — 无
 */

export const name = 'dsh-claude-agent'

import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// 会话映射持久化（DSH 重启后仍可 resume，保住持久对话与记忆）
const SESSIONS_PATH = path.join(os.homedir(), '.dsh', 'claude-agent', 'chat-sessions.json')
function loadSessions() {
  try { return JSON.parse(readFileSync(SESSIONS_PATH, 'utf8')) } catch { return {} }
}
function saveSessions(obj) {
  try { mkdirSync(path.dirname(SESSIONS_PATH), { recursive: true }); writeFileSync(SESSIONS_PATH, JSON.stringify(obj, null, 2)) } catch { /* ignore */ }
}

export const inject = ['subprocess']

export function apply(ctx) {
  const conversations = new Map()   // convId -> { text, cursor, status, sessionId }
  const chatSessions = new Map()    // chatSessionId -> { sessionId, cwd }  （能力 2 多轮用）
  // 开机 hydrate：恢复上次运行留下的会话映射（resume 后 Claude 仍有记忆）
  for (const [key, rec] of Object.entries(loadSessions())) {
    if (rec && rec.sessionId) chatSessions.set(key, rec)
  }
  function persistChatSessions() {
    var obj = {}
    chatSessions.forEach(function (v, k) { obj[k] = v })
    saveSessions(obj)
  }

  let sdkPromise = null
  function sdk() {
    if (!sdkPromise) {
      sdkPromise = import('@anthropic-ai/claude-agent-sdk').catch((error) => {
        sdkPromise = null
        throw new Error('dsh-claude-agent: cannot load claude-agent-sdk: ' + String(error && error.message || error))
      })
    }
    return sdkPromise
  }

  function newUuid() {
    return randomUUID()
  }

  /**
   * 跑一次 query，收集最终文本。
   * @param {string} prompt
   * @param {{sessionId?: string, resume?: string, cwd?: string, permissionMode?: string, model?: string}} opts
   *   model 支持两种：claude-xxx = SDK 原生模型（options.model）；
   *                  其他（如 deepseek-v4-pro / glm-5.3）= 视为 ANTHROPIC_BASE_URL 端点上的模型，
   *                  per-call 覆盖 ANTHROPIC_MODEL + 三个 DEFAULT_*（不动全局 settings.json）。
   */
  async function runQuery(prompt, opts = {}) {
    const mod = await sdk()
    const options = { persistSession: true }
    if (opts.cwd) options.cwd = opts.cwd
    // 模型：claude-xxx 走 SDK 原生 options.model；DSH 系模型走 env 覆盖（保留 CLI 全部工具能力）
    if (opts.model && /^claude/i.test(opts.model)) {
      options.model = opts.model
    } else if (opts.model) {
      options.env = Object.assign({}, process.env, {
        ANTHROPIC_MODEL: opts.model,
        ANTHROPIC_DEFAULT_SONNET_MODEL: opts.model,
        ANTHROPIC_DEFAULT_OPUS_MODEL: opts.model,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: opts.model,
      })
    }
    // 权限模式：full=完全（bypassPermissions，像 DSH Full access）；默认受限
    if (opts.permissionMode === 'full') {
      options.permissionMode = 'bypassPermissions'
    }
    if (opts.resume) {
      options.resume = opts.resume      // 续接已有会话（多轮）
    } else if (opts.sessionId) {
      options.sessionId = opts.sessionId // 新建会话带 id（多轮第一轮）
    }
    const stream = mod.query({ prompt, options })
    let finalText = ''
    for await (const msg of stream) {
      if (msg.type === 'assistant' && msg.message) {
        const content = msg.message.content || []
        for (const b of content) {
          if (b.type === 'text' && b.text) finalText += b.text
        }
      }
      if (msg.type === 'result' && typeof msg.result === 'string' && msg.result) {
        finalText = msg.result
      }
    }
    return finalText
  }

  ctx.provide('claudeAgent', {
    /**
     * 能力 2 直接对话（支持多轮 + cwd）。
     * @param {string} message
     * @param {{chatKey?: string, cwd?: string}} [opts] chatKey 传之前返回的续接多轮；缺省新建
     * @returns {Promise<{convId: string|null, chatKey?: string, text: string}>}
     */
    async chat(message, opts = {}) {
      const chatKey = opts.chatKey
      const cwd = opts.cwd
      let sdkSessionId
      if (chatKey) {
        // 续接：从映射取 SDK session id
        const rec = chatSessions.get(chatKey)
        sdkSessionId = rec ? rec.sessionId : undefined
      }
      const isNew = sdkSessionId === undefined
      if (isNew) sdkSessionId = newUuid()
      const text = await runQuery(String(message), {
        sessionId: isNew ? sdkSessionId : undefined,
        resume: isNew ? undefined : sdkSessionId,
        cwd,
        model: opts.model,
        permissionMode: opts.permissionMode === 'full' ? 'full' : 'restricted',
      })
      // 记录会话（用于下次续接）
      const effectiveKey = chatKey || ('chat-' + sdkSessionId)
      chatSessions.set(effectiveKey, { sessionId: sdkSessionId, cwd, permissionMode: opts.permissionMode === 'full' ? 'full' : 'restricted' })
      persistChatSessions()
      return { convId: null, chatKey: effectiveKey, text }
    },
    async startConversation(prompt, opts = {}) {
      const convId = `cl${Date.now()}-${Math.floor(Math.random() * 1e4)}`
      const conv = { text: '', cursor: 0, status: 'running', sessionId: newUuid(), cwd: opts.cwd }
      conversations.set(convId, conv)
      runQuery(String(prompt), { sessionId: conv.sessionId, cwd: opts.cwd, model: opts.model }).then((text) => {
        conv.text = text
        conv.status = 'done'
      }).catch((error) => {
        conv.text = '[错误] ' + String(error && error.message || error)
        conv.status = 'error'
      })
      return convId
    },
    pull(convId) {
      const conv = conversations.get(convId)
      if (!conv) return { status: 'error', newText: '', totalLength: 0, done: true }
      const newText = conv.text.slice(conv.cursor)
      conv.cursor = conv.text.length
      const done = conv.status === 'done' || conv.status === 'error'
      return { status: conv.status, newText, totalLength: conv.text.length, done }
    },
    dispose() { /* query 自管理进程 */ },
  })
}
