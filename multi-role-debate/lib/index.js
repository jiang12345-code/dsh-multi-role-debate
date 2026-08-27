/**
 * multi-role-debate — 编排层 (host)
 *
 * inject 两个实体（codexAgent / claudeAgent），组合成：
 *   能力 1（多角色并行论证）：
 *     role.start({ question }) → 并行调 codexAgent + claudeAgent 的 startConversation，
 *                                 返回两路 convId；DSH 自己的视角由主会话（我）承担
 *                                  （看到两路后我写第三路 + 汇总）
 *     role.pull()               → 聚合两个实体的 pull 增量（三栏实时流）
 *   能力 2（直接对话）：
 *     role.chat({ agent, message }) → 调对应实体的 chat（Obsidian 式）
 *
 * webServer route: /__dsh-mrd/api（client fetch）
 */

import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'multi-role-debate'

// 用 ctx.get 可选获取实体（不 inject —— 实体未加载时不阻塞本 bundle 的树激活）
export const inject = ['webServer']

// ---------- Judge / 角色模型配置（UI 自由配置 + 持久化） ----------
// 默认：Judge 用独立强模型；codex/claude 留空 = 用其默认。
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.resolve(__dirname, '../../../multi-role-debate.config.json')
export const DEFAULT_CONFIG = {
  judge: { provider: 'deepseek-official', model: 'deepseek-v4-pro', reasoningEffort: 'high', maxTokens: 4096 },
  codexModel: '',
  claudeModel: '',
}
function loadConfig() {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    const cfg = { ...DEFAULT_CONFIG, ...raw }
    cfg.judge = { ...DEFAULT_CONFIG.judge, ...(raw && raw.judge) }
    return cfg
  } catch { return { ...DEFAULT_CONFIG, judge: { ...DEFAULT_CONFIG.judge } } }
}
function saveConfig(cfg) {
  try {
    mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
    writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
  } catch { /* ignore */ }
}

// llm 不可用 / 失败时的确定性兜底汇总（保证 DSH 列总有内容）
function fallbackSummary(question, codexText, claudeText) {
  const clip = (t, n) => { t = (t || '').trim(); return t.length > n ? t.slice(0, n) + '…' : t }
  const cx = clip(codexText, 500)
  const cl = clip(claudeText, 500)
  return '## DSH 汇总\n\n**问题**：' + (question || '') +
    '\n\n### Codex 摘要\n' + (cx || '（无输出）') +
    '\n\n### Claude 摘要\n' + (cl || '（无输出）') +
    '\n\n> 注：DSH 主会话模型未可用，以上为两路论证的截取摘要。'
}

// ---------- 对话流触发 ----------
// 主会话用户消息里出现辩论触发词 → 提取问题并启动论证。
const DEBATE_TRIGGER = /(多角色论证|多角色辩论|开始论证|多角色辩一辩|辩论一下)/
function extractDebateQuestion(text) {
  const s = String(text || '')
  const m = s.match(DEBATE_TRIGGER)
  if (!m) return null
  let q = s.slice(m.index + m[0].length)
  q = q.replace(/^[\s：:，,、\-—]+/, '')
  q = q.replace(/^(请|帮我|麻烦|一下|来|个|给我)+/, '')
  q = q.replace(/^[\s：:，,、\-—]+/, '').trim()
  if (q.length < 2) {
    q = s.replace(DEBATE_TRIGGER, '').replace(/^[\s：:，,、\-—]+/, '').replace(/^(请|帮我|麻烦|一下|来|个|给我)+/, '').trim()
  }
  return q.length >= 2 ? q : null
}
function messageText(message) {
  const content = (message && message.content) || []
  let out = ''
  for (const c of content) { if (c && c.type === 'text') out += c.text || '' }
  return out
}

// ---------- Judge 模型配置（UI 自由配置，持久化；见 DEFAULT_CONFIG） ----------
// 作为第三方汇总的 Judge：建议用独立强模型而非会话自己的 Flash。
// 若该模型不可用，synthesizeWithLlm 会回退到当前会话模型，再兜底。

export function apply(ctx) {
  const web = ctx.get('webServer')
  if (!web) return

  // 模型配置（持久化）
  const config = loadConfig()

  // 从 sessionId 解析当前工作区 cwd（跟随用户在哪个工作区）
  async function resolveCwd(sessionId) {
    if (!sessionId) return undefined
    try {
      const sq = ctx.get('sessionQuery')
      if (!sq) return undefined
      const surface = await sq.readSurface(sessionId)
      const header = surface && surface.header
      const cwd = header && header.cwd
      return typeof cwd === 'string' && cwd ? cwd : undefined
    } catch (error) {
      ctx.logger?.warn?.('multi-role-debate: resolveCwd failed: ' + String(error && error.message || error))
      return undefined
    }
  }

  // ---------- 状态 ----------
  const state = {
    question: '',
    triggerSessionId: null, // 触发本轮论证的会话（回对话指向它）
    monitor: null,          // 宿主后台完成监听 timer id
    codexConvId: null,
    claudeConvId: null,
    codexText: '',    // 两路论证的累加全文（增量在 snapshot 累加）
    claudeText: '',
    dshText: '',      // DSH 视角（主会话汇总后填）
    dshSynth: false,  // 防止重复触发汇总
    posted: false,    // 结果是否已回对话（只提交一次）
    startedAt: 0,
  }

  // ---------- DSH 主会话模型汇总 ----------
  // 用当前会话的模型（provider/model 取自 agentDefaultModel）生成中立的第三方汇总。
  // llm 不可用或失败时回退到 fallbackSummary，保证第三列总有内容。
  async function callLlm(c, system, user, sessionId) {
    const messages = [{ role: 'user', content: [{ type: 'text', text: user }] }]
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 90000)
    let out = ''
    try {
      const options = { provider: c.provider, model: c.model, messages, system, maxTokens: c.maxTokens || 1200, sessionId, signal: ac.signal }
      if (c.reasoningEffort) options.reasoningEffort = c.reasoningEffort
      const stream = ctx.get('llm')
      if (!stream || !stream.stream) return ''
      for await (const chunk of stream.stream(options)) {
        if (chunk && chunk.type === 'text-delta') out += chunk.text || ''
        if (chunk && chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') { out = ''; break }
      }
    } catch (error) {
      ctx.logger?.warn?.('multi-role-debate llm call failed (' + String(c && c.model) + '): ' + String(error && error.message || error))
      out = ''
    } finally {
      clearTimeout(timer)
    }
    return (out && out.trim()) ? out.trim() : ''
  }

  // Judge 模型优先用插件配置（deepseek-v4-pro）；失败回退到当前会话模型；再失败兜底摘要。
  async function synthesizeWithLlm(question, codexText, claudeText, sessionId) {
    const system = '你是 DSH 主会话的论证汇总助手。你将读到两路 AI 对同一问题的论证，输出一份中立、结构化、有洞见的中文汇总。'
    const user = '【问题】' + (question || '') +
      '\n\n【Codex 论证】\n' + ((codexText || '').trim() || '（无输出）') +
      '\n\n【Claude 论证】\n' + ((claudeText || '').trim() || '（无输出）') +
      '\n\n请用 markdown 输出：1) 共识点 2) 分歧点 3) 综合结论与建议。控制在中肯、简要，300 字以内。'
    const candidates = []
    const j = config && config.judge
    if (j && j.model) {
      candidates.push({ provider: j.provider, model: j.model, reasoningEffort: j.reasoningEffort, maxTokens: j.maxTokens })
    }
    const selSvc = ctx.get('agentDefaultModel')
    const sel = selSvc && selSvc.currentSelection ? selSvc.currentSelection() : undefined
    if (sel && sel.provider && sel.model) {
      candidates.push({ provider: sel.provider, model: sel.model, reasoningEffort: sel.reasoningEffort, maxTokens: undefined })
    }
    // 去重（provider:model 相同则只试一次）
    const seen = new Set()
    for (const c of candidates) {
      const key = (c.provider || '') + ':' + (c.model || '')
      if (seen.has(key)) continue
      seen.add(key)
      const text = await callLlm(c, system, user, sessionId)
      if (text) return text
    }
    return fallbackSummary(question, codexText, claudeText)
  }

  // ---------- 汇总 + 回对话（带锁，客户端与宿主 monitor 共用） ----------
  async function runSynthesize(sessionId) {
    if (state.dshSynth || state.dshText) return
    const codex = ctx.get('codexAgent')
    const claude = ctx.get('claudeAgent')
    if (!codex || !claude) return
    const codexText = state.codexText
    const claudeText = state.claudeText
    if (!codexText && !claudeText) return
    state.dshSynth = true
    try {
      const dshText = await synthesizeWithLlm(state.question, codexText, claudeText, sessionId)
      state.dshText = dshText || ''
      if (state.dshText && !state.posted) {
        state.posted = true
        const target = state.triggerSessionId || sessionId
        postResultToConversation(target, state.dshText)
      }
    } finally {
      state.dshSynth = false
    }
  }

  // ---------- 结果回对话 ----------
  // 论证汇总完成后，把结果经主会话的 inbox 喂给 DSH 主会话；主会话自己算 turn 号处理并呈现，
  // 因此不会与真实对话的 turn 序列冲突（turn 安全）。失败则静默跳过，不影响论证。
  function postResultToConversation(sessionId, dshText) {
    if (!sessionId || !dshText) return false
    const agents = ctx.get('agents')
    if (!agents || !agents.get) return false
    const agent = agents.get(sessionId)
    if (!agent) return false
    const message = {
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text: 'Codex 与 Claude 的并行论证已完成。请把以下汇总结果直接呈现给用户（保留 markdown 格式）：\n\n' + dshText }],
      source: { kind: 'plugin', plugin: 'multi-role-debate' },
    }
    try {
      // followup = send(next-turn, wakeup=true)：自动唤醒驱动处理；兜底用 inbox.append
      if (typeof agent.followup === 'function') agent.followup(message)
      else if (agent.inbox && typeof agent.inbox.append === 'function') agent.inbox.append(message)
      else return false
      return true
    } catch (error) {
      ctx.logger?.warn?.('multi-role-debate postResultToConversation failed: ' + String(error && error.message || error))
      return false
    }
  }

  // ---------- 启动论证（tab 按钮 / 对话流触发共用） ----------
  // 并行启动 codex + claude，重置状态，记录触发会话（回对话指向它）。
  async function startDebate(question, sessionId, cwd) {
    const codex = ctx.get('codexAgent')
    const claude = ctx.get('claudeAgent')
    if (!codex || !claude) {
      ctx.logger?.warn?.('multi-role-debate: 实体未就绪（dsh-codex-agent / dsh-claude-agent 未加载）')
      return { ok: false, error: '实体未就绪' }
    }
    const q = String(question || '').trim()
    if (!q) return { ok: false, error: 'no question' }
    state.question = q
    state.triggerSessionId = sessionId || null
    state.dshText = ''
    state.dshSynth = false
    state.posted = false
    state.codexText = ''
    state.claudeText = ''
    state.startedAt = Date.now()
    // 清掉上一次的宿主监听，再启动本轮监听（不依赖 tab 是否打开）
    if (state.monitor) { state.monitor(); state.monitor = null }
    const opts = {}
    if (cwd) opts.cwd = cwd
    else {
      const c = await resolveCwd(sessionId)
      if (c) opts.cwd = c
    }
    try {
      // 按配置为各自实体带不同模型（留空 = 该实体默认）
      const codexOpts = { ...opts }; if (config.codexModel) codexOpts.model = config.codexModel
      const claudeOpts = { ...opts }; if (config.claudeModel) claudeOpts.model = config.claudeModel
      state.codexConvId = await codex.startConversation(q, codexOpts)
      state.claudeConvId = await claude.startConversation(q, claudeOpts)
    } catch (error) {
      ctx.logger?.warn?.('multi-role-debate startDebate failed: ' + String(error && error.message || error))
      return { ok: false, error: String(error && error.message || error) }
    }
    // 宿主后台监听：两路都完成 → 自动汇总 + 回对话（即使 tab 没开）
    const timerSvc = ctx.get('timer')
    const startMonitor = () => timerSvc && timerSvc.interval ? timerSvc.interval(() => {
      try {
        const snap = snapshot()
        if (snap.allDone) {
          if (state.monitor) { state.monitor(); state.monitor = null }
          runSynthesize(state.triggerSessionId || sessionId).catch((e) => {
            ctx.logger?.warn?.('multi-role-debate 自动汇总失败: ' + String(e && e.message || e))
          })
        }
      } catch (e) { /* ignore */ }
    }, 1500) : null
    state.monitor = startMonitor()
    return { ok: true, question: q }
  }

  function snapshot() {
    const codex = ctx.get('codexAgent')
    const claude = ctx.get('claudeAgent')
    if (!codex || !claude) {
      return { question: state.question, allDone: false, error: '实体未就绪（dsh-codex-agent / dsh-claude-agent 未加载）', roles: {} }
    }
    // 拉两实体增量，并累加为全文
    const cx = state.codexConvId ? codex.pull(state.codexConvId) : { status: 'idle', newText: '', totalLength: 0, done: false }
    const cl = state.claudeConvId ? claude.pull(state.claudeConvId) : { status: 'idle', newText: '', totalLength: 0, done: false }
    if (cx.newText) state.codexText += cx.newText
    if (cl.newText) state.claudeText += cl.newText
    const allDone = cx.done && cl.done
    return {
      question: state.question,
      allDone,
      roles: {
        dsh:    { label: 'DSH 汇总', status: state.dshText ? 'done' : (state.dshSynth ? 'running' : 'idle'), newText: state.dshText, totalLength: state.dshText.length },
        codex:  { label: 'Codex', status: cx.status, newText: state.codexText, totalLength: state.codexText.length },
        claude: { label: 'Claude', status: cl.status, newText: state.claudeText, totalLength: state.claudeText.length },
      },
    }
  }

  const api = {
    // 能力 1：启动多角色并行论证（cwd 跟随当前工作区）
    'role.start': async (args) => {
      const r = await startDebate(args && args.question, args && args.sessionId, args && args.cwd)
      if (!r.ok) return r
      return { ok: true, question: r.question, codexConvId: state.codexConvId, claudeConvId: state.claudeConvId }
    },
    // 能力 1：轮询增量
    'role.pull': () => ({ ok: true, ...snapshot() }),
    // 能力 2：直接对话单实体（cwd 跟随当前工作区：传 sessionId 自动解析，或显式 cwd）
    'role.chat': async (args) => {
      const codex = ctx.get('codexAgent')
      const claude = ctx.get('claudeAgent')
      if (!codex || !claude) return { ok: false, error: '实体未就绪（dsh-codex-agent / dsh-claude-agent 未加载）' }
      const agent = (args && args.agent) === 'claude' ? claude : codex
      const message = String((args && args.message) || '').trim()
      if (!message) return { ok: false, error: 'empty message' }
      const opts = {}
      if (args && args.chatKey) opts.chatKey = args.chatKey
      // 权限模式：full=完全访问（像 DSH Full access）；缺省 restricted（工作区内）
      if (args && args.permissionMode) opts.permissionMode = args.permissionMode
      // 模型：显式指定优先，否则用配置的 codex/claude 模型（留空=各自默认）
      const cfgModel = (args && args.agent) === 'claude' ? config.claudeModel : config.codexModel
      if (args && args.model) opts.model = args.model
      else if (cfgModel) opts.model = cfgModel
      // cwd：显式 cwd 优先，否则从 sessionId 解析当前工作区
      if (args && args.cwd) {
        opts.cwd = args.cwd
      } else {
        const cwd = await resolveCwd(args && args.sessionId)
        if (cwd) opts.cwd = cwd
      }
      const r = await agent.chat(message, opts)
      return { ok: true, agent: (args && args.agent) || 'codex', chatKey: r.chatKey || null, text: r.text }
    },
    // 能力 1 完成时，由 DSH 主会话模型汇总两路论证 → 写入 state.dshText（第三列）
    'role.synthesize': async (args) => {
      const codex = ctx.get('codexAgent')
      const claude = ctx.get('claudeAgent')
      if (!codex || !claude) return { ok: false, error: '实体未就绪' }
      // 已在生成中：返回已有进度，避免重复触发
      if (state.dshSynth) {
        return { ok: true, question: state.question, dshText: state.dshText, synthesizing: true }
      }
      if (state.dshText) {
        return { ok: true, question: state.question, dshText: state.dshText }
      }
      if (!state.codexText && !state.claudeText) {
        return { ok: true, question: state.question, dshText: '', error: 'no content to synthesize' }
      }
      await runSynthesize(args && args.sessionId)
      return { ok: true, question: state.question, dshText: state.dshText }
    },
    // 模型配置：读
    'config.get': () => ({ ok: true, config }),
    // 模型配置：写（merge + 持久化）
    'config.set': (args) => {
      const patch = (args && args.config) || {}
      if (patch.judge && typeof patch.judge === 'object') config.judge = { ...config.judge, ...patch.judge }
      if (typeof patch.codexModel === 'string') config.codexModel = patch.codexModel
      if (typeof patch.claudeModel === 'string') config.claudeModel = patch.claudeModel
      saveConfig(config)
      return { ok: true, config }
    },
    // Judge 可选模型：列出 DSH 提供方的模型（供 UI 下拉）
    'config.listJudgeModels': async () => {
      const provider = config.judge.provider || 'deepseek-official'
      const llm = ctx.get('llm')
      let models = []
      if (llm && llm.listModels) {
        try { models = await llm.listModels(provider) } catch (e) { /* ignore */ }
      }
      // 兜底：已知模型
      if (models.length === 0) {
        models = [{ id: 'deepseek-v4-pro', name: 'deepseek-v4-pro' }, { id: 'deepseek-v4-flash', name: 'deepseek-v4-flash' }, { id: 'deepseek-v4-flash-vision-exp', name: 'deepseek-v4-flash-vision-exp' }]
      }
      return { ok: true, provider, models: models.map(m => ({ id: (m && m.id) || m, name: (m && m.name) || m })) }
    },
    // 全部 DSH provider×model 候选（供 Codex/Claude 角色下拉；值形如 dsh:<provider>/<model>，
    // role.chat 对 dsh: 前缀走 DSH 引擎直驱并保留跨轮记忆——见下文路由）
    'config.listDshModels': async () => {
      const llm = ctx.get('llm')
      const out = []
      if (llm && llm.listProviders && llm.listModels) {
        const provs = llm.listProviders() || []
        for (const p of provs) {
          const pid = (p && p.id) || p
          try {
            const ms = await llm.listModels(pid)
            ;(ms || []).forEach((m) => {
              const id = (m && m.id) || m
              out.push({ value: 'dsh:' + pid + '/' + id, label: 'DSH · ' + ((m && m.name) || id) + (pid === (config.judge.provider || '') ? '' : ' (' + pid + ')') })
            })
          } catch (e) { /* 单个 provider 失败跳过 */ }
        }
      }
      return { ok: true, models: out }
    },
  }

  function handle(req, res) {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let payload = {}
      try { payload = JSON.parse(body || '{}') } catch {}
      const method = String((payload && payload.method) || '')
      const fn = api[method]
      if (!fn) {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'unknown method ' + method }))
        return
      }
      Promise.resolve(fn((payload && payload.args) || {})).then((result) => {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' })
        res.end(JSON.stringify(result))
      }).catch((error) => {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(error && error.message || error) }))
      })
    })
  }

  ctx.effect(() => web.register({ kind: 'prefix', path: '/__dsh-mrd', handler: handle }))

  // ---------- 对话流触发 ----------
  // 观察所有会话的 user/message：含辩论触发词 → 提取问题 → 启动论证。
  // 结果回对话已由 synthesize 的 postResultToConversation 处理（指向 triggerSessionId）。
  ctx.effect(() => ctx.on('session/event', (session, event) => {
    if (!event || event.type !== 'user/message') return
    const msg = event.data || {}
    const src = msg.source
    // 跳过本插件注入的消息（含"多角色论证"的"结果回对话"文本），避免二次触发论证
    if (src && src.kind === 'plugin' && src.plugin === 'multi-role-debate') return
    const sessionId = session && session.id
    const text = messageText(msg)
    const question = extractDebateQuestion(text)
    if (!question) return
    // 已在跑同一问题则跳过（防重复触发）
    if (state.question && state.question === question) return
    ctx.logger?.info?.(`multi-role-debate: 对话流触发论证: ${question}`)
    startDebate(question, sessionId, undefined).catch((e) => {
      ctx.logger?.warn?.('multi-role-debate 对话流触发失败: ' + String(e && e.message || e))
    })
  }))

  // 让 DSH 主会话面对"辩论请求"时不直接作答，而是一句"已启动"并延后（结果稍后呈现）。
  // 防御式注册：若 order 与其它 bundle 冲突抛错，则跳过（不影响论证本身）。
  const sp = ctx.get('systemPrompt')
  if (sp && sp.section) {
    try {
      ctx.effect(() => sp.section({
        name: 'multi-role-debate-trigger',
        order: 7000,
        text: '若用户请求"多角色论证 / 多角色辩论 / 开始论证"，不要直接回答该问题。请回复一句话说明你已让 Codex 与 Claude 并行论证，稍后会把汇总结果呈现给用户，然后停止本轮。',
      }))
    } catch (error) {
      ctx.logger?.warn?.('multi-role-debate: 注册 systemPrompt section 失败（跳过）: ' + String(error && error.message || error))
    }
  }
}
