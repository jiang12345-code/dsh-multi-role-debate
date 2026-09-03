window.__ModuleLoader__.load({
  id: "multi-role-debate",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    // multi-role-debate — Client half（按设计稿复刻：GitHub Dark + DM Sans + JetBrains Mono）
    // Mode A：多角色论证三栏；Mode B：直接对话。
    // 手写 React.createElement（DSH 插件无 JSX/Tailwind 转换），CSS 用 styles.insert。

    const CSS = `
:root {
  --mrd-base: #0d1117; --mrd-surface: #161b22; --mrd-elevated: #1c2128;
  --mrd-border: #30363d; --mrd-border-light: #21262d;
  --mrd-txt: #e6edf3; --mrd-txt2: #8b949e; --mrd-txt3: #484f58;
  --mrd-accent: #58a6ff; --mrd-accent-subtle: rgba(88,166,255,.15);
  --mrd-green: #3fb950; --mrd-green-subtle: rgba(63,185,80,.15);
  --mrd-yellow: #d29922; --mrd-yellow-subtle: rgba(210,153,34,.15);
  --mrd-purple: #bc8cff; --mrd-purple-subtle: rgba(188,140,255,.15);
}
.mrd-wrap { font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif; color:var(--mrd-txt); background:var(--mrd-base); padding:16px 20px; height:100%; display:flex; flex-direction:column; gap:14px; min-height:0; }
.mrd-top { display:flex; align-items:center; justify-content:space-between; }
.mrd-brand { display:flex; align-items:center; gap:8px; }
.mrd-brand-dot { width:8px; height:8px; border-radius:50%; background:var(--mrd-accent); }
.mrd-brand-name { font-size:13px; font-weight:600; }
.mrd-brand-sub { font-size:11px; color:var(--mrd-txt3); }
.mrd-tabs { display:flex; gap:2px; background:var(--mrd-surface); border:1px solid var(--mrd-border); border-radius:8px; padding:2px; }
.mrd-tab { padding:6px 14px; font-size:12px; font-weight:500; border-radius:6px; color:var(--mrd-txt2); cursor:pointer; transition:all .15s; }
.mrd-tab:hover { color:var(--mrd-txt); background:var(--mrd-elevated); }
.mrd-tab.active { background:var(--mrd-accent-subtle); color:var(--mrd-accent); border:1px solid rgba(88,166,255,.2); }
.mrd-toolbar { display:flex; align-items:center; gap:12px; }
.mrd-question-input { flex:1; background:var(--mrd-surface); border:1px solid var(--mrd-border); border-radius:8px; padding:10px 14px; font-size:13px; color:var(--mrd-txt); outline:none; }
.mrd-question-input:focus { border-color:rgba(88,166,255,.5); box-shadow:0 0 0 1px rgba(88,166,255,.2); }
.mrd-btn { display:flex; align-items:center; gap:8px; padding:9px 18px; background:var(--mrd-accent); color:#fff; font-size:13px; font-weight:500; border:none; border-radius:8px; cursor:pointer; transition:all .15s; }
.mrd-btn:hover { background:rgba(88,166,255,.9); }
.mrd-btn:disabled { opacity:.5; cursor:default; }
.mrd-btn svg { width:14px; height:14px; }
.mrd-panels { flex:1; display:flex; flex-direction:column; gap:12px; min-height:0; overflow-y:auto; }
.mrd-panel { flex:1 1 auto; min-height:160px; display:flex; flex-direction:column; background:var(--mrd-surface); border:1px solid var(--mrd-border); border-radius:12px; overflow:hidden; }
.mrd-panel-head { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-bottom:1px solid var(--mrd-border-light); background:rgba(28,33,40,.5); }
.mrd-panel-head-left { display:flex; align-items:center; gap:10px; }
.mrd-ic { display:flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:6px; }
.mrd-ic svg { width:15px; height:15px; }
.mrd-panel-title { font-size:13px; font-weight:600; }
.mrd-badge { display:inline-flex; align-items:center; gap:6px; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:500; }
.mrd-badge-dot { width:6px; height:6px; border-radius:50%; animation: mrdPulse 1.5s ease-in-out infinite; }
.mrd-count { font-size:11px; color:var(--mrd-txt3); font-family:'JetBrains Mono',monospace; }
.mrd-panel-body { flex:1; overflow-y:auto; padding:14px 16px; font-family:'JetBrains Mono',monospace; font-size:13px; line-height:1.7; color:rgba(230,237,243,.9); white-space:pre-wrap; word-break:break-word; }
.mrd-empty { color:var(--mrd-txt3); font-style:italic; }
.mrd-note { display:flex; align-items:center; justify-content:center; gap:8px; padding:8px 0; font-size:12px; color:var(--mrd-txt3); }
.mrd-note svg { width:14px; height:14px; }
@keyframes mrdPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
/* Mode B (direct chat) */
.mrd-ai-pills { display:flex; align-items:center; gap:2px; background:var(--mrd-surface); border:1px solid var(--mrd-border); border-radius:8px; padding:2px; }
.mrd-ai-pill { display:flex; align-items:center; gap:6px; padding:5px 12px; border-radius:6px; font-size:12px; font-weight:500; color:var(--mrd-txt2); cursor:pointer; transition:all .15s; }
.mrd-ai-pill:hover { background:var(--mrd-elevated); }
.mrd-ai-pill.active { background:var(--mrd-green-subtle); color:var(--mrd-green); border:1px solid rgba(63,185,80,.2); }
.mrd-ai-pill.claude.active { background:var(--mrd-purple-subtle); color:var(--mrd-purple); border:1px solid rgba(188,140,255,.2); }
.mrd-ai-pill svg { width:13px; height:13px; }
.mrd-perm-wrap { position:relative; }
.mrd-perm-trigger { display:flex; align-items:center; gap:8px; padding:7px 12px; background:var(--mrd-surface); border:1px solid var(--mrd-border); border-radius:8px; cursor:pointer; font-size:12px; transition:all .15s; }
.mrd-perm-trigger:hover { border-color:var(--mrd-border); }
.mrd-perm-trigger.is-full { border-color:rgba(210,153,34,.4); }
.mrd-perm-trigger-title { color:var(--mrd-txt2); font-weight:500; }
.mrd-perm-trigger.is-full .mrd-perm-trigger-title { color:var(--mrd-yellow); }
.mrd-perm-caret { width:11px; height:11px; color:var(--mrd-txt3); }
.mrd-perm-menu { position:absolute; top:calc(100%+6px); left:0; width:288px; background:var(--mrd-elevated); border:1px solid var(--mrd-border); border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,.4); z-index:100; padding:6px; }
.mrd-perm-item { display:flex; align-items:flex-start; gap:12px; padding:12px; border-radius:8px; cursor:pointer; transition:background .12s; }
.mrd-perm-item:hover { background:var(--mrd-surface); }
.mrd-perm-item.active { background:rgba(88,166,255,.12); border:1px solid rgba(88,166,255,.1); }
.mrd-perm-ic { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; flex:none; margin-top:2px; font-size:15px; }
.mrd-perm-item-body { flex:1; min-width:0; }
.mrd-perm-item-title-row { display:flex; align-items:center; gap:8px; }
.mrd-perm-item-title { font-size:13px; font-weight:600; }
.mrd-perm-item-check { width:13px; height:13px; color:var(--mrd-accent); }
.mrd-perm-item-sub { font-size:11px; color:var(--mrd-txt2); margin-top:2px; line-height:1.5; }
.mrd-chat-area { flex:1; min-height:0; overflow-y:auto; background:var(--mrd-surface); border:1px solid var(--mrd-border); border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:20px; }
.mrd-msg { display:flex; gap:12px; }
.mrd-msg-avatar { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; flex:none; margin-top:2px; background:var(--mrd-elevated); border:1px solid var(--mrd-border-light); }
.mrd-msg-avatar svg { width:14px; height:14px; color:var(--mrd-txt2); }
.mrd-msg-avatar.codex { background:var(--mrd-green-subtle); }
.mrd-msg-avatar.codex svg { color:var(--mrd-green); }
.mrd-msg-avatar.claude { background:var(--mrd-purple-subtle); }
.mrd-msg-avatar.claude svg { color:var(--mrd-purple); }
.mrd-msg-body { flex:1; min-width:0; }
.mrd-msg-meta { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.mrd-msg-name { font-size:12px; font-weight:600; color:var(--mrd-txt2); }
.mrd-msg-name.user { color:var(--mrd-txt2); }
.mrd-msg-name.codex { color:var(--mrd-green); }
.mrd-msg-name.claude { color:var(--mrd-purple); }
.mrd-msg-time { font-size:10px; color:var(--mrd-txt3); }
.mrd-msg-text { font-size:13px; color:var(--mrd-txt); line-height:1.7; white-space:pre-wrap; word-break:break-word; }
.mrd-msg-text code { background:var(--mrd-accent-subtle); color:var(--mrd-accent); padding:1px 6px; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:12px; }
.mrd-msg-pre { background:var(--mrd-base); border:1px solid var(--mrd-border-light); border-radius:8px; padding:12px; font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--mrd-txt2); overflow-x:auto; margin:8px 0; }
.mrd-md-h1 { font-size:15px; font-weight:700; margin:8px 0 4px; }
.mrd-md-h2 { font-size:14px; font-weight:700; margin:6px 0 3px; }
.mrd-md-h3 { font-size:13px; font-weight:600; margin:4px 0 2px; }
.mrd-md-p { margin:1px 0; }
.mrd-md-li { margin:2px 0; padding-left:18px; position:relative; }
.mrd-md-li::before { content:'•'; position:absolute; left:4px; color:var(--mrd-txt3); }
.mrd-chat-input-row { display:flex; align-items:center; gap:12px; background:var(--mrd-surface); border:1px solid var(--mrd-border); border-radius:12px; padding:12px 16px; }
.mrd-chat-input-row:focus-within { border-color:rgba(88,166,255,.5); box-shadow:0 0 0 1px rgba(88,166,255,.2); }
.mrd-chat-input { flex:1; background:transparent; border:none; color:var(--mrd-txt); font-size:13px; outline:none; }
.mrd-chat-input::placeholder { color:var(--mrd-txt3); }
.mrd-send { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; background:var(--mrd-accent); color:#fff; border:none; cursor:pointer; transition:background .15s; }
.mrd-send:hover { background:rgba(88,166,255,.9); }
.mrd-send:disabled { opacity:.5; cursor:default; }
.mrd-send svg { width:16px; height:16px; }
.mrd-chat-status { display:flex; align-items:center; gap:6px; margin-top:6px; padding-left:4px; font-size:10px; color:var(--mrd-txt3); }
.mrd-chat-status svg { width:11px; height:11px; }
/* 模型配置面板 */
.mrd-gear { display:flex; align-items:center; gap:5px; height:32px; padding:0 12px; border-radius:8px; background:var(--mrd-surface); border:1px solid var(--mrd-border); color:var(--mrd-txt2); cursor:pointer; transition:all .15s; font-size:12px; font-weight:500; }
.mrd-gear:hover { color:var(--mrd-txt); border-color:var(--mrd-border); }
.mrd-gear.active { color:var(--mrd-accent); border-color:rgba(88,166,255,.4); background:var(--mrd-accent-subtle); }
.mrd-sys-line { text-align:center; font-size:11px; color:var(--mrd-txt2); opacity:.85; margin:2px 0; }
.mrd-config-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:1000; display:flex; align-items:flex-start; justify-content:center; padding:8vh 20px 20px; }
.mrd-config-panel { width:520px; max-width:100%; background:var(--mrd-elevated); border:1px solid var(--mrd-border); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.5); overflow:hidden; }
.mrd-config-head { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--mrd-border-light); }
.mrd-config-head-title { font-size:14px; font-weight:600; }
.mrd-config-close { width:28px; height:28px; border-radius:6px; background:transparent; border:none; color:var(--mrd-txt2); cursor:pointer; font-size:18px; line-height:1; }
.mrd-config-close:hover { color:var(--mrd-txt); background:var(--mrd-surface); }
.mrd-config-body { padding:18px 20px; display:flex; flex-direction:column; gap:16px; max-height:60vh; overflow-y:auto; }
.mrd-config-group { display:flex; flex-direction:column; gap:10px; padding:14px; background:var(--mrd-surface); border:1px solid var(--mrd-border-light); border-radius:10px; }
.mrd-config-group-title { font-size:12px; font-weight:600; color:var(--mrd-accent); }
.mrd-config-row { display:flex; align-items:center; gap:10px; }
.mrd-config-row label { flex:none; width:120px; font-size:12px; color:var(--mrd-txt2); }
.mrd-config-row input, .mrd-config-row select { flex:1; background:var(--mrd-base); border:1px solid var(--mrd-border); border-radius:6px; color:var(--mrd-txt); padding:8px 10px; font-size:12px; outline:none; font-family:'JetBrains Mono',monospace; }
.mrd-config-row input:focus, .mrd-config-row select:focus { border-color:rgba(88,166,255,.5); }
.mrd-config-hint { font-size:11px; color:var(--mrd-txt3); }
.mrd-config-actions { display:flex; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid var(--mrd-border-light); }
.mrd-config-btn { padding:8px 16px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; }
.mrd-config-btn.ghost { background:transparent; color:var(--mrd-txt2); border:1px solid var(--mrd-border); }
.mrd-config-btn.primary { background:var(--mrd-accent); color:#fff; border:none; }
.mrd-config-btn.primary:hover { background:rgba(88,166,255,.9); }
.mrd-config-saved { color:var(--mrd-green); font-size:12px; }
`;

    function injectStyles(css) {
      const el = document.createElement('style')
      el.textContent = css
      document.head.appendChild(el)
      return () => { el.remove() }
    }

    async function callApi(method, args) {
      const res = await fetch("/__dsh-mrd/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method, args: args || {} }) })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error((data && data.error) || ("HTTP " + res.status))
      return data
    }

    // ---- inline SVG icons (lucide-style) ----
    const ic = (path, extra) => React.createElement('svg', Object.assign({ width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, extra || {}), path)
    const ICONS = {
      terminal: ic(React.createElement(React.Fragment, null,
        React.createElement('polyline', { points: '4 17 10 11 4 5' }),
        React.createElement('line', { x1: 12, y1: 19, x2: 20, y2: 19 }))),
      sparkles: ic(React.createElement('path', { d: 'M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z' })),
      brain: ic(React.createElement('path', { d: 'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3 2.5 2.5 0 0 1 1.46-2.04z' })),
      user: ic(React.createElement(React.Fragment, null,
        React.createElement('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
        React.createElement('circle', { cx: 12, cy: 7, r: 4 }))),
      play: ic(React.createElement('polygon', { points: '5 3 19 12 5 21 5 3' })),
      arrowUp: ic(React.createElement(React.Fragment, null,
        React.createElement('path', { d: 'M12 19V5' }),
        React.createElement('path', { d: 'M5 12l7-7 7 7' }))),
      info: ic(React.createElement(React.Fragment, null,
        React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
        React.createElement('line', { x1: 12, y1: 16, x2: 12, y2: 12 }),
        React.createElement('line', { x1: 12, y1: 8, x2: 12.01, y2: 8 }))),
      zap: ic(React.createElement('polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' })),
      chevronDown: ic(React.createElement('polyline', { points: '6 9 12 15 18 9' })),
      check: ic(React.createElement('polyline', { points: '20 6 9 17 4 12' })),
    }

    // ---- permission options ----
    const PERM_OPTIONS = [
      { id: 'restricted', icon: '\u{1F6E1}', title: 'Read Only', sub: '仅当前工作区，可执行命令', iconBg: 'var(--mrd-accent-subtle)' },
      { id: 'full',       icon: '\u{1F513}', title: 'Full access', sub: '访问任何目录（像 DSH Full access）', iconBg: 'var(--mrd-yellow-subtle)' },
    ]

    // ---- panel accent map (badge 颜色跟随各角色) ----
    const ACCENT = {
      dsh:    { c: 'var(--mrd-accent)',  sub: 'var(--mrd-accent-subtle)' },
      codex:  { c: 'var(--mrd-green)',   sub: 'var(--mrd-green-subtle)' },
      claude: { c: 'var(--mrd-purple)',  sub: 'var(--mrd-purple-subtle)' },
    }

    // ---- 轻量 markdown 渲染（正文/聊天气泡共用）：标题/列表/代码块/行内 code+bold ----
    function infmt(s) {
      const parts = String(s == null ? '' : s).split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g)
      return parts.map(function (p, idx) {
        if (/^`[^`\n]+`$/.test(p)) return React.createElement('code', { key: idx }, p.slice(1, -1))
        if (/^\*\*[^*\n]+\*\*$/.test(p)) return React.createElement('strong', { key: idx }, p.slice(2, -2))
        return p
      })
    }
    function RenderMD(props) {
      const text = String((props && props.text) || '')
      const hc = (props && props.headingColor) || 'var(--mrd-accent)'
      try {
        const lines = text.split('\n')
        const blocks = []
        let i = 0
        while (i < lines.length) {
          const line = lines[i]
          if (/^```/.test(line.trim())) {
            const code = []; i++
            while (i < lines.length && !/^```/.test(lines[i].trim())) { code.push(lines[i]); i++ }
            i++ // skip closing fence
            blocks.push(React.createElement('pre', { className: 'mrd-msg-pre', key: blocks.length }, code.join('\n')))
            continue
          }
          const h = line.match(/^(#{1,4})\s+(.*)$/)
          if (h) {
            const level = Math.min(h[1].length, 3)
            blocks.push(React.createElement('div', { key: blocks.length, className: 'mrd-md-h' + level, style: { color: hc } }, infmt(h[2])))
            i++; continue
          }
          if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
            blocks.push(React.createElement('div', { key: blocks.length, className: 'mrd-md-li' }, infmt(line.replace(/^\s*([-*]|\d+[.)])\s+/, ''))))
            i++; continue
          }
          blocks.push(React.createElement('div', { key: blocks.length, className: 'mrd-md-p' }, infmt(line)))
          i++
        }
        return React.createElement(React.Fragment, null, blocks)
      } catch (e) {
        return React.createElement('div', { className: 'mrd-msg-text' }, text)
      }
    }
    function fmtCount(n) {
      const num = typeof n === 'number' ? n : parseInt(n, 10)
      return (num > 0 ? num.toLocaleString('en-US') : '') + (num > 0 ? ' 字' : '')
    }

    function DebatePanel(props) {
      const sessionId = props && props.sessionId
      const sessionCwd = props && props.cwd
      const [mode, setMode] = React.useState('debate')
      const [question, setQuestion] = React.useState('')
      const [roles, setRoles] = React.useState({})
      const [busy, setBusy] = React.useState(false)
      const [chatAgent, setChatAgent] = React.useState('codex')
      const [chatInput, setChatInput] = React.useState('')
      const [chatBusy, setChatBusy] = React.useState(false)
      const [chatLog, setChatLog] = React.useState([])
      // chatKey 持久化（localStorage，按 sessionId 分桶）：刷新/切 tab 不丢，直接对话可续接记忆
      var ckKey = 'mrd-chatkeys:' + (sessionId || 'default')
      var [chatKeys, setChatKeys] = React.useState(function () {
        try { return JSON.parse(localStorage.getItem(ckKey) || '{}') } catch (e) { return {} }
      })
      const [permissionMode, setPermissionMode] = React.useState('restricted')
      const [showPermMenu, setShowPermMenu] = React.useState(false)
      const [msgTime, setMsgTime] = React.useState('')
      const synthRef = React.useRef(false)
      const lastModelRef = React.useRef({})
      const lastCwdRef = React.useRef({})
      // 模型配置
      const [configOpen, setConfigOpen] = React.useState(false)
      const [cfg, setCfg] = React.useState({ judge: { model: '', reasoningEffort: 'high', maxTokens: 4096 }, codexModel: '', claudeModel: '' })
      const [judgeModels, setJudgeModels] = React.useState([])
      const [dshModels, setDshModels] = React.useState([])
      const [codexDefault, setCodexDefault] = React.useState('')
      const [cfgSaved, setCfgSaved] = React.useState(false)

      const refreshConfig = () => callApi("config.get", {}).then(r => {
        if (r && r.config) setCfg({ judge: { ...(r.config.judge || {}) }, codexModel: r.config.codexModel || '', claudeModel: r.config.claudeModel || '' })
        if (r && r.codexDefaultModel) setCodexDefault(r.codexDefaultModel)
      }).catch(()=>{})
      const refreshJudgeModels = () => callApi("config.listJudgeModels", {}).then(r => { if (r && r.models) setJudgeModels(r.models) }).catch(()=>{})
      const refreshDshModels = () => callApi("config.listDshModels", {}).then(r => { if (r && r.models) setDshModels(r.models) }).catch(()=>{})
      React.useEffect(() => { refreshConfig(); refreshJudgeModels(); refreshDshModels() }, [])
      const saveConfig = async () => { setCfgSaved(false); await callApi("config.set", { config: cfg }).catch(()=>{}); setCfgSaved(true); setTimeout(()=>setCfgSaved(false), 2000) }
      const cfgSet = (k, v) => setCfg(prev => ({ ...prev, judge: k === 'judgeModel' ? { ...prev.judge, model: v } : k === 'judgeEffort' ? { ...prev.judge, reasoningEffort: v } : k === 'judgeMax' ? { ...prev.judge, maxTokens: v } : prev.judge, codexModel: k === 'codexModel' ? v : prev.codexModel, claudeModel: k === 'claudeModel' ? v : prev.claudeModel }))

      // Mode A: start debate
      const start = async () => {
        setBusy(true); setRoles({}); synthRef.current = false
        try { await callApi("role.start", { question, sessionId, cwd: sessionCwd }) }
        catch (e) { console.error("role.start failed", e); setBusy(false) }
      }
      React.useEffect(() => {
        if (!busy) return
        let stopped = false
        let synthAt = 0
        const id = setInterval(async () => {
          if (stopped) return
          try {
            const snap = await callApi("role.pull", {})
            if (!snap || !snap.roles) return
            setRoles(snap.roles)
            if (!snap.allDone) return
            const dsh = snap.roles.dsh || {}
            if (dsh.totalLength > 0) { stopped = true; clearInterval(id); setBusy(false); return }
            // allDone 但 DSH 列还没内容：触发一次主会话汇总（不等待完成，继续轮询）
            if (!synthRef.current) {
              synthRef.current = true; synthAt = Date.now()
              callApi("role.synthesize", { sessionId, cwd: sessionCwd }).catch(e => { synthRef.current = false; console.error("role.synthesize failed", e) })
            } else if (synthAt && Date.now() - synthAt > 180000) {
              // 极端兜底：汇总长时间仍无内容 → 停止轮询，防永久 busy
              stopped = true; clearInterval(id); setBusy(false)
            }
          } catch (e) { console.error("role.pull failed", e) }
        }, 250)
        return () => clearInterval(id)
      }, [busy])

      // 挂载恢复：tab 重挂载后，从 host 回填当前争论状态（运行中则恢复轮询，已完成则显示结果）
      React.useEffect(() => {
        let alive = true
        callApi("role.pull", {}).then(snap => {
          if (!alive || !snap || !snap.roles) return
          setRoles(snap.roles)
          if (snap.question) setQuestion(snap.question)
          // 只要确实有论证在跑（question 非空）且 DSH 列尚未出内容，就恢复轮询；
          // 否则保持空闲（等待用户重新开始），避免空转。
          const dsh = snap.roles.dsh || {}
          if (snap.question && (!snap.allDone || dsh.totalLength === 0)) setBusy(true)
        }).catch(() => {})
        return () => { alive = false }
      }, [])

      // Mode B: send chat
      const sendChat = async () => {
        if (!chatInput.trim()) return
        setChatBusy(true)
        const text = chatInput; setChatInput('')
        setMsgTime(new Date().toTimeString().slice(0, 5))
        setChatLog(prev => [...prev, { role: 'user', text }])
        try {
          const opts = { agent: chatAgent, message: text, sessionId, cwd: sessionCwd, permissionMode }
          // 模型切换检测：该 agent 的生效模型变了 → 丢弃旧会话钥匙，下一轮以新模型新会话开始（并在聊天流里提示）
          var effM = (chatAgent === 'claude' ? cfg.claudeModel : cfg.codexModel) || ''
          if (chatKeys[chatAgent] && lastModelRef.current[chatAgent] !== undefined && lastModelRef.current[chatAgent] !== effM) {
            delete chatKeys[chatAgent]
            setChatLog(prev => [...prev, { role: 'sys', text: 'ℹ️ 模型已切换为「' + (effM || (chatAgent + ' 默认')) + '」，已开启新会话。' }])
          }
          lastModelRef.current[chatAgent] = effM
          if (chatKeys[chatAgent]) opts.chatKey = chatKeys[chatAgent]
          const r = await callApi("role.chat", opts)
          if (r && r.cwd) {
            if (lastCwdRef.current[chatAgent] !== r.cwd) { lastCwdRef.current[chatAgent] = r.cwd; setChatLog(function (prev) { return prev.concat([{ role: "sys", text: "📁 工作区: " + r.cwd }]) }) }
          } else {
            setChatLog(function (prev) { return prev.concat([{ role: "sys", text: "⚠️ 未能解析当前会话工作区，本次对话在 DSH 启动目录运行" }]) })
          }
          if (r.chatKey) {
            setChatKeys(prev => { var n = { ...prev, [chatAgent]: r.chatKey }; try { localStorage.setItem(ckKey, JSON.stringify(n)) } catch (e) {} return n })
          }
          setChatLog(prev => [...prev, { role: chatAgent, text: r.text || '(no response)' }])
        } catch (e) {
          setChatLog(prev => [...prev, { role: chatAgent, text: '[错误] ' + String(e && e.message || e) }])
        } finally { setChatBusy(false) }
      }
      // close perm menu on outside click
      React.useEffect(() => {
        if (!showPermMenu) return
        const onDoc = (e) => { if (!e.target.closest || !e.target.closest('.mrd-perm-wrap')) setShowPermMenu(false) }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
      }, [showPermMenu])

      // helpers
      const badgeFor = (st, key) => {
        const acc = ACCENT[key] || ACCENT.dsh
        const map = {
          running: ['Streaming', acc.c, acc.sub, true],
          done:    ['完成', acc.c, acc.sub, false],
          error:   ['错误', 'var(--mrd-txt2)', 'var(--mrd-elevated)', false],
          idle:    ['等待中', 'var(--mrd-yellow)', 'var(--mrd-yellow-subtle)', false],
        }
        const [txt, color, bg, pulse] = map[st] || map.idle
        return React.createElement('span', { className: 'mrd-badge', style: { color, background: bg } },
          pulse ? React.createElement('span', { className: 'mrd-badge-dot', style: { background: color } }) : null,
          txt)
      }
      const renderPanel = (key, title, icon, icBg, icColor) => {
        const r = roles[key] || { label: title, status: 'idle', totalLength: 0, newText: '' }
        const count = r.totalLength ? fmtCount(r.totalLength) : null
        return React.createElement('div', { className: 'mrd-panel' },
          React.createElement('div', { className: 'mrd-panel-head' },
            React.createElement('div', { className: 'mrd-panel-head-left' },
              React.createElement('div', { className: 'mrd-ic', style: { background: icBg } },
                React.createElement('span', { style: { color: icColor } }, icon)),
              React.createElement('span', { className: 'mrd-panel-title' }, title),
              badgeFor(r.status, key)),
            React.createElement('span', { className: 'mrd-count' }, count || '…')),
          React.createElement('div', { className: 'mrd-panel-body' },
            r.totalLength > 0 && r.newText
              ? React.createElement(RenderMD, { text: r.newText, headingColor: icColor })
              : React.createElement('span', { className: 'mrd-empty' }, title === 'DSH 汇总' ? '等待 Codex 与 Claude 完成论证后生成汇总...' : '等待论证...')))
      }

      // Mode B renderers
      const msgMeta = (role) => {
        const name = role === 'user' ? '用户' : role === 'codex' ? 'Codex' : 'Claude'
        const cls = role === 'user' ? 'user' : role === 'codex' ? 'codex' : 'claude'
        return React.createElement('div', { className: 'mrd-msg-meta' },
          React.createElement('span', { className: 'mrd-msg-name ' + cls }, name),
          React.createElement('span', { className: 'mrd-msg-time' }, msgTime))
      }
      const msgAvatar = (role) => {
        const cls = role === 'user' ? '' : role === 'codex' ? ' codex' : ' claude'
        const icon = role === 'user' ? ICONS.user : role === 'codex' ? ICONS.terminal : ICONS.sparkles
        return React.createElement('div', { className: 'mrd-msg-avatar' + cls }, icon)
      }
      const renderMsg = (m, i) => React.createElement('div', { className: 'mrd-msg', key: i },
        msgAvatar(m.role),
        React.createElement('div', { className: 'mrd-msg-body' }, msgMeta(m.role),
          m.role === 'user'
            ? React.createElement('div', { className: 'mrd-msg-text' }, m.text)
            : React.createElement(RenderMD, { text: m.text, headingColor: m.role === 'codex' ? 'var(--mrd-green)' : 'var(--mrd-purple)' })))
      const renderChatLog = () => {
        const items = chatLog.length === 0
          ? React.createElement('div', { className: 'mrd-empty', style: { fontStyle: 'italic', fontSize: 12 } }, '开始与 ' + (chatAgent === 'codex' ? 'Codex' : 'Claude') + ' 对话...')
          : chatLog.map(function (m, i) {
              if (m.role === 'sys') return React.createElement('div', { key: i, className: 'mrd-sys-line' }, m.text)
              return renderMsg(m, i)
            })
        return React.createElement('div', { className: 'mrd-chat-area' }, items)
      }

      // ---- mode header ----
      const tabHeader = React.createElement('div', { className: 'mrd-top' },
        React.createElement('div', { className: 'mrd-brand' },
          React.createElement('div', { className: 'mrd-brand-dot' }),
          React.createElement('span', { className: 'mrd-brand-name' }, 'multi-role-debate'),
          React.createElement('span', { className: 'mrd-brand-sub' }, '· conversation.view')),
        React.createElement('div', { className: 'mrd-tabs' },
          React.createElement('button', { className: 'mrd-tab' + (mode === 'debate' ? ' active' : ''), onClick: () => setMode('debate') }, '多角色论证'),
          React.createElement('button', { className: 'mrd-tab' + (mode === 'chat' ? ' active' : ''), onClick: () => setMode('chat') }, '直接对话'),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 } },
            React.createElement('button', { className: 'mrd-gear' + (configOpen ? ' active' : ''), onClick: () => setConfigOpen(!configOpen), title: '模型配置' },
              React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                React.createElement('circle', { cx: 12, cy: 12, r: 3 }),
                React.createElement('path', { d: 'M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12' })),
              React.createElement('span', { style: { marginLeft: 2 } }, '模型配置')))))
      // ---- Mode A ----
      const debateView = mode === 'debate'
        ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'mrd-toolbar' },
              React.createElement('input', { className: 'mrd-question-input', value: question, onChange: e => setQuestion(e.target.value), placeholder: '输入你的问题...', disabled: busy }),
              React.createElement('button', { className: 'mrd-btn', onClick: start, disabled: busy || !question.trim() },
                ICONS.play, busy ? '论证中...' : '开始论证')),
            React.createElement('div', { className: 'mrd-panels' },
              renderPanel('dsh', 'DSH 汇总', ICONS.brain, 'var(--mrd-accent-subtle)', 'var(--mrd-accent)'),
              renderPanel('codex', 'Codex', ICONS.terminal, 'var(--mrd-green-subtle)', 'var(--mrd-green)'),
              renderPanel('claude', 'Claude', ICONS.sparkles, 'var(--mrd-purple-subtle)', 'var(--mrd-purple)')),
            React.createElement('div', { className: 'mrd-note' }, ICONS.info, 'Codex 与 Claude 并行论证；全部完成后由 DSH 主会话汇总'))
        : null

      // ---- Mode B ----
      const permMenu = showPermMenu ? React.createElement('div', { className: 'mrd-perm-menu' },
        PERM_OPTIONS.map(opt => React.createElement('div', {
          key: opt.id, className: 'mrd-perm-item' + (permissionMode === opt.id ? ' active' : ''),
          onClick: () => { setPermissionMode(opt.id); setShowPermMenu(false) },
        },
          React.createElement('div', { className: 'mrd-perm-ic', style: { background: opt.iconBg } }, opt.icon),
          React.createElement('div', { className: 'mrd-perm-item-body' },
            React.createElement('div', { className: 'mrd-perm-item-title-row' },
              React.createElement('span', { className: 'mrd-perm-item-title' }, opt.title),
              permissionMode === opt.id ? React.createElement('span', { className: 'mrd-perm-item-check' }, ICONS.check) : null),
            React.createElement('div', { className: 'mrd-perm-item-sub' }, opt.sub))))) : null
      const currentPerm = PERM_OPTIONS.find(o => o.id === permissionMode) || PERM_OPTIONS[0]
      const chatView = mode === 'chat'
        ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'mrd-toolbar' },
              React.createElement('div', { className: 'mrd-ai-pills' },
                ['codex', 'claude'].map(a => React.createElement('button', { key: a, className: 'mrd-ai-pill' + (a === 'claude' ? ' claude' : '') + (chatAgent === a ? ' active' : ''), onClick: () => setChatAgent(a) },
                  a === 'codex' ? ICONS.terminal : ICONS.sparkles, a === 'codex' ? 'Codex' : 'Claude'))),
              React.createElement('div', { className: 'mrd-perm-wrap' },
                React.createElement('button', { className: 'mrd-perm-trigger' + (permissionMode === 'full' ? ' is-full' : ''), onClick: () => setShowPermMenu(!showPermMenu) },
                  React.createElement('span', { style: { fontSize: 15 } }, currentPerm.icon),
                  React.createElement('span', { className: 'mrd-perm-trigger-title' }, currentPerm.title),
                  React.createElement('span', { className: 'mrd-perm-caret' }, ICONS.chevronDown)),
                permMenu)),
            renderChatLog(),
            React.createElement('div', { className: 'mrd-chat-input-wrap' },
              React.createElement('div', { className: 'mrd-chat-input-row' },
                React.createElement('input', { className: 'mrd-chat-input', value: chatInput, onChange: e => setChatInput(e.target.value), placeholder: '输入消息...', disabled: chatBusy, onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } } }),
                React.createElement('button', { className: 'mrd-send', onClick: sendChat, disabled: chatBusy || !chatInput.trim() }, ICONS.arrowUp)),
              React.createElement('div', { className: 'mrd-chat-status' }, ICONS.zap, '当前: ' + (chatAgent === 'codex' ? 'Codex' : 'Claude') + ' · ' + currentPerm.title)))
        : null

      // ---- 模型配置 modal ----
      const cfgField = (label, node) => React.createElement('div', { className: 'mrd-config-row' },
        React.createElement('label', null, label), node)
      const cfgTotal = (cfg.judge.model ? cfg.judge.model : '(未选)') + ' / Codex: ' + (cfg.codexModel || '(默认)') + ' / Claude: ' + (cfg.claudeModel || '(默认)')
      const configModal = configOpen ? React.createElement('div', { className: 'mrd-config-overlay', onClick: () => setConfigOpen(false) },
        React.createElement('div', { className: 'mrd-config-panel', onClick: function (e) { e.stopPropagation() } },
          React.createElement('div', { className: 'mrd-config-head' },
            React.createElement('span', { className: 'mrd-config-head-title' }, '模型配置'),
            React.createElement('button', { className: 'mrd-config-close', onClick: () => setConfigOpen(false) }, '×')),
          React.createElement('div', { className: 'mrd-config-body' },
            React.createElement('div', { className: 'mrd-config-group' },
              React.createElement('div', { className: 'mrd-config-group-title' }, 'DSH 汇总（Judge）'),
              cfgField('模型', React.createElement('select', { value: cfg.judge.model || '', onChange: function (e) { cfgSet('judgeModel', e.target.value) } },
                React.createElement('option', { value: '' }, '（按会话默认）'),
                judgeModels.map(function (m) { return React.createElement('option', { key: m.id, value: m.id }, m.name || m.id) }))),
              cfgField('推理档', React.createElement('select', { value: cfg.judge.reasoningEffort || 'high', onChange: function (e) { cfgSet('judgeEffort', e.target.value) } },
                ['off', 'low', 'medium', 'high', 'max'].map(function (x) { return React.createElement('option', { key: x, value: x }, x) }))),
              cfgField('maxTokens', React.createElement('input', { type: 'number', value: cfg.judge.maxTokens || '', onChange: function (e) { cfgSet('judgeMax', e.target.value) } })),
              React.createElement('div', { className: 'mrd-config-hint' }, 'Judge 是第三方汇总的"最强大脑"。')),
            React.createElement('div', { className: 'mrd-config-group' },
              React.createElement('div', { className: 'mrd-config-group-title' }, 'Codex 模型'),
              cfgField('模型', React.createElement('input', {
                list: 'mrd-codex-models',
                placeholder: '留空 = Codex 默认；可选 DSH 引擎模型',
                value: cfg.codexModel,
                onChange: function (e) { cfgSet('codexModel', e.target.value) },
              })),
              React.createElement('datalist', { id: 'mrd-codex-models' },
                dshModels.map(function (m) { return React.createElement('option', { key: m.value, value: m.value }, m.label) }),
                dshModels.map(function (m) { return React.createElement('option', { key: m.value + '-bare', value: (m.value.split('/')[1] || m.value) }, (m.value.split('/')[1] || m.value) + '（Codex 原生尝试）') }),
              ),
              React.createElement('div', { className: 'mrd-config-hint' },
                '下拉选「dsh:」开头 → DSH 引擎直驱（带持久记忆）；手填 → Codex CLI 尝试使用，不支持会回退默认。',
                codexDefault ? React.createElement('span', null, ' Codex 当前默认：' + codexDefault + '。') : null)),
            React.createElement('div', { className: 'mrd-config-group' },
              React.createElement('div', { className: 'mrd-config-group-title' }, 'Claude 模型'),
              cfgField('模型', React.createElement('input', {
                list: 'mrd-claude-models',
                placeholder: '留空 = Claude 默认；可选 DSH 选择器同款模型',
                value: cfg.claudeModel,
                onChange: function (e) { cfgSet('claudeModel', e.target.value) },
              })),
              React.createElement('datalist', { id: 'mrd-claude-models' },
                dshModels.map(function (m) { return React.createElement('option', { key: m.value, value: m.value }, m.label) }),
                judgeModels.map(function (m) { return React.createElement('option', { key: m.id, value: m.id }, m.name || m.id) }),
                ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'].map(function (x) { return React.createElement('option', { key: x, value: x }, x + '（Claude 原生）') }),
              ),
              React.createElement('div', { className: 'mrd-config-hint' }, '选「dsh:」开头 → DSH 引擎直驱（保留 CLI 工具能力需走 env 覆盖路线：手填同款裸名）；手填 claude-xxx → 原生；留空 = 全局 settings.json 默认（当前即 deepseek-v4-pro）。')),
            React.createElement('div', { className: 'mrd-config-hint' }, '当前：' + cfgTotal)),
          React.createElement('div', { className: 'mrd-config-actions' },
            cfgSaved ? React.createElement('span', { className: 'mrd-config-saved' }, '已保存 ✓') : null,
            React.createElement('button', { className: 'mrd-config-btn ghost', onClick: () => setConfigOpen(false) }, '取消'),
            React.createElement('button', { className: 'mrd-config-btn primary', onClick: saveConfig }, '保存')))) : null

      return React.createElement('div', { className: 'mrd-wrap' }, tabHeader, debateView, chatView, configModal)
    }

    function apply(ctx) {
      const slots = ctx.get("slots")
      if (slots === undefined) return
      ctx.effect(() => injectStyles(CSS))
      slots.inject("conversation.view", () => slots.register(
        { name: "conversation.view", id: "multi-role-debate", label: "多角色论证", order: 8 },
        (props) => React.createElement(DebatePanel, props)
      ))
    }

    exports.apply = apply
    return module.exports
  }
})
