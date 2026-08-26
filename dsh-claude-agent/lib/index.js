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

export const inject = ['subprocess']

export function apply(ctx) {
  const conversations = new Map()   // convId -> { text, cursor, status, sessionId }
  const chatSessions = new Map()    // chatSessionId -> { sessionId, cwd }  （能力 2 多轮用）

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
   * @param {{sessionId?: string, resume?: string, cwd?: string, permissionMode?: string}} opts
   */
  async function runQuery(prompt, opts = {}) {
    const mod = await sdk()
    const options = { persistSession: true }
    if (opts.cwd) options.cwd = opts.cwd
    // 模型：允许调用方指定（UI 自由配置），留空用 SDK 默认
    if (opts.model) options.model = opts.model
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
