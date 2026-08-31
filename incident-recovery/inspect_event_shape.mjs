/**
 * 探针：在幸存会话日志里找一条含 "incident-recovery" 的 write 事件，
 * 打印其真实 JSON 结构（键名/嵌套），供修正 mine_skills_from_logs.mjs 的事件遍历。
 * 只读。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { scanZstdFrames, createZstdFrameDecoder } from 'file:///C:/Users/73618/.dsh/profiles/node_modules/@deepseek-ai/dsh-session-persistence-jsonl/lib/types/zstd.js'

const ROOT = 'C:/Users/73618/.dsh/sessions'

async function decodeLines(path) {
  const buf = await readFile(path)
  const { frames } = scanZstdFrames(buf)
  const dec = createZstdFrameDecoder()
  const lines = []
  try { for (const v of dec.decode(buf, frames)) for (const l of Buffer.from(v).toString('utf8').split('\n')) if (l !== '') lines.push(l) } finally { dec.close() }
  return lines
}

function sketch(o, depth = 0, maxDepth = 4) {
  if (o === null || typeof o !== 'object') return typeof o === 'string' ? `str(${o.length})` : typeof o
  if (Array.isArray(o)) return `[${o.length}]`
  if (depth >= maxDepth) return '{...}'
  const parts = []
  for (const k of Object.keys(o)) {
    const v = o[k]
    parts.push(`${k}:${Array.isArray(v) ? `[${v.length}]` : typeof v === 'object' && v ? sketch(v, depth + 1, maxDepth) : typeof v === 'string' ? `str(${v.length})` : String(v)}`)
  }
  return '{' + parts.join(', ') + '}'
}

const projects = await readdir(ROOT, { withFileTypes: true })
let shown = 0
outer: for (const proj of projects) {
  if (!proj.isDirectory()) continue
  const sessDirs = await readdir(join(ROOT, proj.name), { withFileTypes: true })
  for (const s of sessDirs) {
    if (!s.isDirectory()) continue
    let lines
    try { lines = await decodeLines(join(ROOT, proj.name, s.name, 'session.jsonl.zstd')) } catch { continue }
    for (const line of lines) {
      if (!line.includes('mine_skills_from_logs.mjs') || !line.includes('incident-recovery')) continue
      let ev
      try { ev = JSON.parse(line) } catch { continue }
      const type = ev.type ?? '?'
      if (!/tool|write|fs|edit/i.test(type)) continue
      console.log(`--- proj=${proj.name} sess=${s.name.slice(0, 18)} type=${type} seq=${ev.seq}`)
      console.log(sketch(ev, 0, 3))
      // 再具体打印疑似参数对象
      const raw = JSON.stringify(ev)
      const i = raw.indexOf('file_path')
      if (i >= 0) console.log('  around "file_path": ' + raw.slice(Math.max(0, i - 120), i + 80))
      const j = raw.indexOf('"content"')
      if (j >= 0) console.log('  around "content": ' + raw.slice(Math.max(0, j - 80), j + 40))
      if (++shown >= 3) break outer
    }
  }
}
if (shown === 0) console.log('[no write event containing mine_skills found — try broader grep]')
