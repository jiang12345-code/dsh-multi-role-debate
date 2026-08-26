/**
 * dsh-codex-agent — Codex 长驻实体 (host-only)
 *
 * 通过 `codex app-server --stdio`（JSON-RPC 2.0 行协议）维护一个长驻 Codex
 * 进程，暴露：
 *   chat(message)             — 能力 2 直接对话：开新 thread + turn，等最终答案
 *   startConversation(prompt) — 能力 1 编排用：开新 thread + turn，返回 convId，可 pull 流
 *   pull(convId)              — 返回某次对话自上次拉取以来的增量
 *   dispose()                 — 关进程
 *
 * 协议（对齐官方 @deepseek-ai/dsh-subagent-codex wire.ts）：
 *   initialize {clientInfo, capabilities} → initialized（notify）
 *   thread/start {cwd, ephemeral:true, approvalPolicy:'never'} → thread.id
 *   turn/start {threadId, input:[{type:'text',text,text_elements:[]}]} → turn.id
 *   流式：item/completed 通知（agentMessage phase: final_answer/null）
 *   完成：turn/completed 通知 → turn.status
 *   服务端请求（approval）→ 返回 {decision:'decline'} 等（无人值守）
 */

import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export const name = 'dsh-codex-agent'

export const inject = ['subprocess']

// codex 是 npm .ps1 shim（node 无法直接 spawn），用 node 跑 codex.js（官方 provider 同法）
// 解析路径：npm 全局优先，回退 profile node_modules
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
function resolveCodexJs() {
  const candidates = [
    'C:/Users/73618/AppData/Roaming/npm/node_modules/@openai/codex/bin/codex.js',
    join(__dirname, '..', '..', '..', 'profiles', 'web', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
    join(__dirname, '..', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
  ]
  for (const c of candidates) {
    try { if (existsSync(c)) return c } catch { /* ignore */ }
  }
  throw new Error('dsh-codex-agent: cannot resolve @openai/codex/bin/codex.js — install codex-cli')
}
const CODEX_JS = resolveCodexJs()

// ---------------------------------------------------------------------------
// 自研 JSON-RPC 行传输（不依赖 DSH 内部 @deepseek-ai/dsh-sdk-protocol）
// stdio 上逐行 JSON-RPC 2.0：请求带 id，通知不带 id，响应按 id 关联。
// ---------------------------------------------------------------------------
class JsonRpcLineTransport {
  constructor(readable, writable) {
    this._writable = writable
    this._pending = new Map()   // id -> { resolve, reject }
    this._notify = []           // 通知/服务端请求监听器
    this._nextId = 1
    const rl = createInterface({ input: readable, crlfDelay: Infinity })
    rl.on('line', (line) => {
      let msg
      try { msg = JSON.parse(line) } catch { return }
      this._handleMessage(msg)
    })
    rl.on('close', () => {
      const err = new Error('JSON-RPC transport closed')
      for (const p of this._pending.values()) p.reject(err)
      this._pending.clear()
    })
    this._rl = rl
  }

  onMessage(handler) { this._notify.push(handler) }

  _handleMessage(msg) {
    // response: {jsonrpc, id, result|error}
    if (msg.id !== undefined && msg.id !== null && !msg.method) {
      const p = this._pending.get(String(msg.id))
      if (!p) return
      this._pending.delete(String(msg.id))
      if (msg.error !== undefined) p.reject(new Error(JSON.stringify(msg.error)))
      else p.resolve(msg.result)
      return
    }
    // notification (no id) or server request (id + method)
    for (const h of this._notify) {
      const reply = h(msg)
      if (reply !== undefined && msg.id !== undefined) {
        this.write({ jsonrpc: '2.0', id: msg.id, result: reply })
      }
    }
  }

  write(obj) {
    this._writable.write(JSON.stringify(obj) + '\n')
  }

  async request(method, params, timeoutMs = 120000) {
    const id = String(this._nextId++)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id)
        reject(new Error(`JSON-RPC timeout: ${method}`))
      }, timeoutMs)
      this._pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })
      this.write({ jsonrpc: '2.0', id: Number(id), method, params })
    })
  }

  notify(method, params) {
    this.write({ jsonrpc: '2.0', method, params })
  }

  close() { this._rl.close() }
}

// ---------------------------------------------------------------------------
// Codex 长驻实体
// ---------------------------------------------------------------------------
class CodexAgent {
  constructor(subprocessService) {
    this._subprocess = subprocessService
    this._transport = null
    this._process = null
    this._threadId = null
    this._threads = new Map()           // chatKey -> threadId （能力 2 多轮续接）
    this._conversations = new Map()   // convId -> { threadId, turnId, text, cursor, status }
  }

  /** 启动长驻 codex app-server --stdio（懒启动，首次调用时） */
  async _ensureStarted() {
    if (this._transport) return
    // 用 subprocess service spawn（graceMs 必填）——node 跑 codex.js（非 .ps1 shim）
    const handle = this._subprocess.spawn({
      argv: [process.execPath, CODEX_JS, 'app-server', '--stdio'],
      cwd: process.cwd(),
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
      graceMs: 30000,
      env: process.env,
    })
    this._process = handle
    this._transport = new JsonRpcLineTransport(handle.stdout, handle.stdin)
    // 服务端请求（approval 等）→ 无人值守应答
    this._transport.onMessage((msg) => {
      if (msg.method === 'item/commandExecution/requestApproval') return { decision: 'decline' }
      if (msg.method === 'item/fileChange/requestApproval') return { decision: 'decline' }
      if (msg.method === 'item/permissions/requestApproval') return { permissions: {}, scope: 'turn' }
      if (msg.method === 'item/tool/requestUserInput') return { answers: {} }
      if (msg.method === 'mcpServer/elicitation/request') return { action: 'decline', content: null, _meta: null }
      return undefined
    })
    // 握手
    await this._transport.request('initialize', {
      clientInfo: { name: 'dsh-codex-agent', title: 'DSH Codex Agent', version: '0.1.0' },
      capabilities: { experimentalApi: false, requestAttestation: false },
    })
    this._transport.notify('initialized')
  }

  /** 线程权限参数（按 mode 切换：restricted=工作区内 + 命令；full=完全访问，像 DSH Full access） */
  static threadParams(mode) {
    if (mode === 'full') {
      return { approvalPolicy: 'never', sandbox: 'danger-full-access' }
    }
    // restricted（默认）：工作区写 + 命令可执行（auto_review）
    return { approvalPolicy: 'on-request', approvalsReviewer: 'auto_review', sandbox: 'workspace-write' }
  }

  /** 开新 thread（能力 2 直接对话 / 能力 1 新论证）—— 非 ephemeral */
  async _startThread(cwd, mode, model) {
    await this._ensureStarted()
    const base = { cwd: cwd || process.cwd(), ephemeral: false, ...CodexAgent.threadParams(mode) }
    let res
    try {
      res = await this._transport.request('thread/start', model ? { ...base, model } : base)
    } catch (error) {
      if (model) res = await this._transport.request('thread/start', base) // 带 model 失败 → 回退不带
      else throw error
    }
    const threadId = res.thread && res.thread.id
    if (!threadId) throw new Error('codex thread/start: no thread id')
    this._threadId = threadId
    return threadId
  }

  /** 续接已有 thread（多轮）—— 非 ephemeral；线程 id 不变，resume 只是激活 */
  async _resumeThread(threadId, cwd, mode, model) {
    await this._ensureStarted()
    const base = { threadId, cwd: cwd || process.cwd(), ephemeral: false, ...CodexAgent.threadParams(mode) }
    try {
      await this._transport.request('thread/resume', model ? { ...base, model } : base)
    } catch (error) {
      if (model) await this._transport.request('thread/resume', base)
      else throw error
    }
    return threadId
  }

  /**
   * 直接对话（能力 2），支持多轮 + cwd。
   * @param {string} message
   * @param {{chatKey?: string, cwd?: string}} [opts] chatKey 传之前返回的续接多轮
   * @returns {Promise<{convId, chatKey?, text}>}
   */
  async chat(message, opts = {}) {
    const chatKey = opts.chatKey
    const mode = opts.permissionMode === 'full' ? 'full' : 'restricted'
    let threadId
    if (chatKey && this._threads.has(chatKey)) {
      threadId = await this._resumeThread(this._threads.get(chatKey), opts.cwd, mode, opts.model)
    } else {
      threadId = await this._startThread(opts.cwd, mode, opts.model)
    }
    const convId = await this.startConversation(message, { threadId, cwd: opts.cwd, model: opts.model })
    const conv = this._conversations.get(convId)
    await conv._done
    conv.status = 'done'
    const effectiveKey = chatKey || ('codex-chat-' + convId)
    this._threads.set(effectiveKey, threadId)
    return { convId, chatKey: effectiveKey, text: conv.text }
  }

  /**
   * 开新对话（能力 1 编排用）：开 thread + turn，返回 convId，流式推进中
   * @param {string} prompt
   * @param {{cwd?: string, threadId?: string}} [opts]
   * @returns {Promise<string>} convId
   */
  async startConversation(prompt, opts = {}) {
    await this._ensureStarted()
    const threadId = opts.threadId || await this._startThread(opts.cwd, undefined, opts.model)
    const convId = `c${Date.now()}-${Math.floor(Math.random() * 1e4)}`
    const conv = { threadId, turnId: null, text: '', cursor: 0, status: 'running' }
    this._conversations.set(convId, conv)

    // 流式：监听 item/completed（agentMessage）→ append；turn/completed → resolve
    const done = new Promise((resolve, reject) => {
      const handler = (msg) => {
        if (msg.method === 'item/completed') {
          const item = msg.params && msg.params.item
          if (item && item.type === 'agentMessage' && typeof item.text === 'string') {
            conv.text += (conv.text ? '\n' : '') + item.text
          }
          return undefined
        }
        if (msg.method === 'turn/completed') {
          // 停掉本对话的监听
          const arr = this._transport._notify
          const i = arr.indexOf(handler)
          if (i >= 0) arr.splice(i, 1)
          conv.status = 'done'
          resolve()
          return undefined
        }
        return undefined
      }
      this._transport.onMessage(handler)
    })
    conv._done = done

    // 启动 turn
    const res = await this._transport.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: prompt, text_elements: [] }],
    })
    conv.turnId = res.turn && res.turn.id
    return convId
  }

  /**
   * 拉取某次对话自上次拉取以来的增量
   * @param {string} convId
   * @returns {{status, newText, totalLength, done}}
   */
  pull(convId) {
    const conv = this._conversations.get(convId)
    if (!conv) return { status: 'error', newText: '', totalLength: 0, done: true }
    const newText = conv.text.slice(conv.cursor)
    conv.cursor = conv.text.length
    const done = conv.status === 'done' || conv.status === 'error'
    return { status: conv.status, newText, totalLength: conv.text.length, done }
  }

  dispose() {
    try { this._process && this._process.terminate && this._process.terminate() } catch { /* ignore */ }
    try { this._transport && this._transport.close() } catch { /* ignore */ }
  }
}

// onMessage 支持 remove（用于 turn/completed 停止监听）
JsonRpcLineTransport.prototype.onMessage.remove = function (handler) {
  const i = this._notify.indexOf(handler)
  if (i >= 0) this._notify.splice(i, 1)
}

export function apply(ctx) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) return
  const agent = new CodexAgent(subprocess)

  ctx.provide('codexAgent', {
    chat: (message, opts) => agent.chat(message, opts),
    startConversation: (prompt, opts) => agent.startConversation(prompt, opts),
    pull: (convId) => agent.pull(convId),
    dispose: () => agent.dispose(),
  })
}
