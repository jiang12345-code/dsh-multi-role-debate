/**
 * incident-recovery v2: 从幸存会话日志找回技能。三条来源：
 *   A) tool/call name=write 且 arguments.file_path 属于 skills/<name>/ → 全文（sidecar: writes/）
 *   B) tool/call name=skill → 其配对 tool/result 含 SKILL.md 全文（sidecar: loads/）
 *   C) tool/call name=pwsh/bash 命令文本中的安装痕迹（git clone / skillhub slug / npm）→ 索引
 * 严格只读会话日志；产物只写 incident-recovery/。
 *
 *   node mine_skills_from_logs.mjs scan      → skill-index.json + writes/ + loads/ + 摘要
 *   node mine_skills_from_logs.mjs extract   → rebuilt/<name>/（write 全文优先，load 兜底，各取 seq 最新）
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { scanZstdFrames, createZstdFrameDecoder } from 'file:///C:/Users/73618/.dsh/profiles/node_modules/@deepseek-ai/dsh-session-persistence-jsonl/lib/types/zstd.js'

const ROOT = 'C:/Users/73618/.dsh/sessions'
const OUT = 'D:/dsh/技术问题解决/incident-recovery'

const NAMES = [
  'archify', 'camoufox-2026', 'computer-use', 'criminal-defense', 'criminal-prosecutor',
  'download-video', 'dsh-model-config', 'dsh-plugin-development', 'dsh-plugin-publish',
  'dsh-session-log-repair', 'find-skills', 'guizang-ppt-skill', 'huashu-nuwa',
  'law-student-bar-prep-questions', 'law-student-case-brief', 'law-student-cold-call-prep',
  'law-student-cold-start-interview', 'law-student-customize', 'law-student-exam-forecast',
  'law-student-flashcards', 'law-student-irac-practice', 'law-student-legal-writing',
  'law-student-outline-builder', 'law-student-session', 'law-student-socratic-drill',
  'law-student-study-plan', 'leader', 'narrate-video', 'orca-cli', 'orchestration',
  'people-procuratorate-review', 'playwright', 'procuratorate-material-collector',
  'procuratorate-research-writing', 'skill-creator', 'trajectory-search', 'transcribe-video',
  'zhang-mingkai-perspective', 'zuiming-analysis',
]
const NAME_SET = new Set(NAMES)

function skillFromPath(p) {
  const m = p.match(/(?:^|[\\/])skills[\\/]([^\\/]+)[\\/](.+)$/)
  if (!m) return null
  const name = m[1].trim()
  return NAME_SET.has(name) ? { name, rel: m[2] } : null
}

function decodeText(path) {
  return asyncFsDecode(path)
}
async function asyncFsDecode(path) {
  let buf
  try { buf = await readFile(path) } catch { return null }
  const { frames } = scanZstdFrames(buf)
  const dec = createZstdFrameDecoder()
  let text = ''
  try { for (const v of dec.decode(buf, frames)) text += Buffer.from(v).toString('utf8') } finally { dec.close() }
  return text.split('\n').filter((x) => x !== '')
}

function bigStrings(o, out, depth = 0) {
  if (!o || depth > 10 || out.length > 3) return out
  if (typeof o === 'string') { if (o.length > 300) out.push(o); return out }
  if (Array.isArray(o)) { for (const x of o) bigStrings(x, out, depth + 1); return out }
  for (const k of Object.keys(o)) bigStrings(o[k], out, depth + 1)
  return out
}

const URL_RE = /https?:\/\/(?:github\.com|raw\.githubusercontent\.com|skillhub-[\w.-]+\.myqcloud\.com|lightmake\.site)[^\s"'\\)>,\]}]+/gi
const SLUG_RE = /(?:download\?slug=|\/skills\/)([\w][\w.-]{2,50})?(?:\.zip)?/gi

async function scan() {
  await mkdir(join(OUT, 'writes'), { recursive: true })
  await mkdir(join(OUT, 'loads'), { recursive: true })
  const hits = {}
  for (const n of NAMES) hits[n] = { writes: [], loads: [], installs: [], mentions: 0, sessions: new Set() }

  const projects = await readdir(ROOT, { withFileTypes: true })
  let logs = 0, events = 0
  for (const proj of projects) {
    if (!proj.isDirectory()) continue
    const sessDirs = await readdir(join(ROOT, proj.name), { withFileTypes: true })
    for (const s of sessDirs) {
      if (!s.isDirectory()) continue
      const lines = await decodeText(join(ROOT, proj.name, s.name, 'session.jsonl.zstd'))
      if (!lines) continue
      logs++
      const pendingLoads = new Map() // callId -> {name, seq}
      for (const line of lines) {
        let ev
        try { ev = JSON.parse(line) } catch { continue }
        if (ev.type !== 'tool/call' && ev.type !== 'tool/result') continue
        events++
        const d = ev.data ?? {}
        const sessShort = s.name.slice(0, 13)
        if (ev.type === 'tool/call') {
          let args = null
          if (typeof d.arguments === 'string') { try { args = JSON.parse(d.arguments) } catch { /* */ } }
          // A) write 全文
          if (d.name === 'write' && args && typeof args.file_path === 'string' && typeof args.content === 'string') {
            const sk = skillFromPath(args.file_path)
            if (sk) {
              const safe = sk.rel.replace(/[^\w.-]+/g, '_')
              const fp = join(OUT, 'writes', `${String(ev.seq).padStart(9, '0')}__${sk.name}__${safe}`)
              await writeFile(fp, args.content)
              hits[sk.name].writes.push({ proj: proj.name, sess: sessShort, seq: ev.seq, rel: sk.rel, len: args.content.length })
            }
          }
          // B) skill 加载登记
          if (d.name === 'skill' && args && NAME_SET.has(String(args.name)) && d.callId) {
            pendingLoads.set(d.callId, { name: args.name, seq: ev.seq })
            hits[args.name].mentions++
          }
          // C) 安装痕迹 / 来源：命令文本
          const cmdText = typeof args?.command === 'string' ? args.command : typeof args?.script === 'string' ? args.script : ''
          if (cmdText) {
            for (const n of NAMES) {
              if (!cmdText.includes(n)) continue
              hits[n].sessions.add(`${proj.name}/${sessShort}`)
              if (hits[n].installs.length < 10) {
                for (const u of cmdText.match(URL_RE) ?? []) if (!hits[n].installs.includes(u)) hits[n].installs.push(u.slice(0, 160))
                for (const m of cmdText.matchAll(/git clone (\S+)/gi)) hits[n].installs.length < 12 && hits[n].installs.push('clone:' + m[1].slice(0, 160))
              }
            }
            // 全局 skillhub slug 下载痕迹
            for (const m of cmdText.matchAll(SLUG_RE)) if (m[1]) { globalSlugs.add(m[1]) }
          }
          // mentions 粗计（非命令文本）
          if (!cmdText) {
            for (const n of NAMES) if (line.includes(`"${n}"`)) hits[n].sessions.add(`${proj.name}/${sessShort}`)
          }
        } else if (ev.type === 'tool/result') {
          const callId = d.callId ?? d.message?.source?.callId
          const pl = callId ? pendingLoads.get(callId) : undefined
          if (pl) {
            const strs = bigStrings(d, [])
            const best = strs.sort((a, b) => b.length - a.length)[0]
            if (best && best.length > 300) {
              const fp = join(OUT, 'loads', `${String(ev.seq).padStart(9, '0')}__${pl.name}.md`)
              await writeFile(fp, best)
              hits[pl.name].loads.push({ proj: proj.name, sess: sessShort, seq: ev.seq, len: best.length })
            }
            pendingLoads.delete(callId)
          }
        }
      }
    }
  }
  const summary = {}
  for (const n of NAMES) {
    const h = hits[n]
    summary[n] = {
      writeFiles: h.writes.map((x) => `${x.rel}#${x.seq}(${x.len}B)`),
      loadCount: h.loads.length, loadSeqs: h.loads.map((x) => x.seq), maxLoadLen: Math.max(0, ...h.loads.map((x) => x.len)),
      sessions: h.sessions.size,
      installs: h.installs,
    }
  }
  await writeFile(join(OUT, 'skill-index.json'), JSON.stringify({ logs, events, globalSlugs: [...globalSlugs], hits: summary }, null, 2))
  console.log(`logs=${logs} toolEvents=${events}`)
  console.log('name'.padEnd(34), 'wr'.padStart(3), 'load'.padStart(4), 'sess'.padStart(4), 'src hints')
  for (const n of NAMES) {
    const s = summary[n]
    console.log(n.padEnd(34), String(s.writeFiles.length).padStart(3), String(s.loadCount).padStart(4), String(s.sessions).padStart(4), ' ', (s.installs[0] ?? s.installs[1] ?? '').slice(0, 90))
  }
  console.log('globalSlugs:', [...globalSlugs].join(', '))
}

const globalSlugs = new Set()

async function extract() {
  const bestWrite = {}   // name/rel -> {seq, file}
  const bestLoad = {}    // name -> {seq, file, len}
  const dirW = join(OUT, 'writes')
  for (const e of await readdir(dirW)) {
    const m = e.match(/^(\d+)__(.+?)__(.+)$/)
    if (!m) continue
    const [, seq, name, rel] = m
    const key = `${name}/${rel}`
    if (!bestWrite[key] || Number(seq) > bestWrite[key].seq) bestWrite[key] = { seq: Number(seq), file: join(dirW, e) }
  }
  const dirL = join(OUT, 'loads')
  for (const e of await readdir(dirL)) {
    const m = e.match(/^(\d+)__([^.]+)\.md$/)
    if (!m) continue
    const [, seq, name] = m
    const file = join(dirL, e)
    const len = (await readFile(file)).length
    if (!bestLoad[name] || Number(seq) > bestLoad[name].seq) bestLoad[name] = { seq: Number(seq), file, len }
  }
  const names = [...new Set([...Object.values(bestWrite).map(() => ''), ...Object.keys(bestWrite).map((k) => k.split('/')[0]), ...Object.keys(bestLoad)])].filter(Boolean)
  const report = {}
  for (const name of names) {
    const rels = Object.entries(bestWrite).filter(([k]) => k.startsWith(name + '/'))
    let gotFiles = 0
    for (const [k, b] of rels) {
      const rel = k.slice(name.length + 1)
      const dest = join(OUT, 'rebuilt', name, rel)
      await mkdir(join(dest, '..'), { recursive: true })
      await writeFile(dest, await readFile(b.file))
      gotFiles++
    }
    const hasSkillMd = rels.some(([k]) => /\/SKILL\.md$/i.test(k))
    if (!hasSkillMd && bestLoad[name]) {
      await mkdir(join(OUT, 'rebuilt', name), { recursive: true })
      await writeFile(join(OUT, 'rebuilt', name, 'SKILL.md'), await readFile(bestLoad[name].file))
      gotFiles++
      report[name] = { via: 'load-result', note: `SKILL.md from skill-load seq ${bestLoad[name].seq} (${bestLoad[name].len}B)` }
    } else {
      report[name] = { via: rels.length ? 'writes' : 'none', files: gotFiles }
    }
  }
  console.log(JSON.stringify(report, null, 2))
}

const mode = process.argv[2] ?? 'scan'
if (mode === 'scan') await scan()
else if (mode === 'extract') await extract()
else console.error('mode: scan | extract')
