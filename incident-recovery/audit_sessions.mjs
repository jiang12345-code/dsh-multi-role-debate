/**
 * audit_sessions.mjs — 会话可见性精确审计：区分「文件真丢了」vs「文件在但没注册」。
 * 只读。输出 incident-recovery/session-audit.json + 控制台分类表。
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { scanZstdFrames, createZstdFrameDecoder } from 'file:///C:/Users/73618/.dsh/profiles/node_modules/@deepseek-ai/dsh-session-persistence-jsonl/lib/types/zstd.js'

const ROOT = 'C:/Users/73618/.dsh/sessions'
const WS = 'C:/Users/73618/.dsh/storages/workspace.json'

function slugToName(slug) {
  return slug.replace(/~([0-9a-fA-F]{4})(?=~|-)/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/^-+D-dsh-+/, '').replace(/[-~]+$/, '') || slug
}

async function decodeFirst(path) {
  const buf = await readFile(path)
  const { frames } = scanZstdFrames(buf)
  const dec = createZstdFrameDecoder()
  const lines = []
  try { for (const v of dec.decode(buf, frames)) for (const l of Buffer.from(v).toString('utf8').split('\n')) if (l !== '') { lines.push(l); if (lines.length > 400000) break } } finally { dec.close() }
  return lines
}

const ws = JSON.parse(await readFile(WS, 'utf8'))
const registered = new Map() // sessionId -> [workspace titles]
for (const w of Object.values(ws.tables.workspaces)) {
  for (const sid of w.sessionIds ?? []) {
    if (!registered.has(sid)) registered.set(sid, [])
    registered.get(sid).push(w.title)
  }
}

const onDisk = []
const projects = await readdir(ROOT, { withFileTypes: true })
for (const p of projects) {
  if (!p.isDirectory()) continue
  const pname = slugToName(p.name)
  for (const s of await readdir(join(ROOT, p.name), { withFileTypes: true })) {
    if (!s.isDirectory()) continue
    const dir = join(ROOT, p.name, s.name)
    let st, lines
    try { st = await stat(join(dir, 'session.jsonl.zstd')); lines = await decodeFirst(join(dir, 'session.jsonl.zstd')) } catch { onDisk.push({ proj: pname, id: s.name, state: 'NOLOG' }); continue }
    let header = null, title = null, lastTs = 0, firstUser = null, imported = false
    for (const l of lines) {
      if (!header) { try { const j = JSON.parse(l); if (j.type === 'session') { header = j; continue } } catch {} }
      if (l.includes('session/title')) { try { const j = JSON.parse(l); title = j.data?.title ?? title } catch {} }
      if (l.includes('session/imported')) imported = true
      if (!firstUser && /"type":"user\/message"/.test(l)) {
        const m = l.match(/"text":"((?:[^"\\]|\\.) {0,200}?)"| "content":"((?:[^"\\]|\\.)*?)"/)
        firstUser = l.replace(/^\{"type":"user\/message"[^}]*\}$/, '').slice(0, 160)
      }
      const t = /"time":(\d+)/.exec(l); if (t && Number(t[1]) > lastTs) lastTs = Number(t[1])
    }
    onDisk.push({
      proj: pname, id: s.name, bytes: st.size, events: lines.length,
      headerTitle: header?.title ?? null, titleEvent: title, imported,
      lastEvent: lastTs ? new Date(lastTs).toISOString().slice(0, 16) : '?',
      firstUserClip: (firstUser ?? '').replace(/\s+/g, ' ').slice(0, 100),
      registered: registered.has(s.name) ? registered.get(s.name).join('|') : 'NOT-REGISTERED',
    })
  }
}

// 注册表里引用了但磁盘没有的
const diskIds = new Set(onDisk.map((x) => x.id))
const ghost = []
for (const [sid, wsTitles] of registered) if (!diskIds.has(sid)) ghost.push({ id: sid, workspaces: wsTitles.join('|') })

const notReg = onDisk.filter((x) => x.registered === 'NOT-REGISTERED')
console.log(`磁盘会话=${onDisk.length} 注册引用=${registered.size} 注册但缺文件(ghost)=${ghost.length} 在盘未注册=${notReg.length}\n`)
console.log('=== 在盘但未注册（UI 可能不显示→可修复）===')
for (const x of notReg) console.log(`[${x.proj}] ${x.id.slice(0, 18)} ${x.bytes}B ev=${x.events} 题=${x.headerTitle ?? x.titleEvent ?? '-'} 最后=${x.lastEvent} 预览=${x.firstUserClip.slice(0, 60)}`)
console.log('\n=== 注册了但文件没了（确认丢失）===')
for (const g of ghost) console.log(`[${g.workspaces}] ${g.id}`)
console.log('\n=== 全部标题清单（幸存会话）===')
for (const x of onDisk) {
  const t = x.headerTitle ?? x.titleEvent ?? '(无名)'
  console.log(`[${x.proj}] ${t}  ${x.lastEvent}  ${x.bytes}B  reg=${x.registered.slice(0, 20)}`)
}
await writeFile('D:/dsh/技术问题解决/incident-recovery/session-audit.json', JSON.stringify({ onDisk, ghost }, null, 2))
