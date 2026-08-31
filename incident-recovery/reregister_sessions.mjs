/**
 * reregister_sessions.mjs — 事故修复：
 *  1) 用 session_projcache 全量视图 vs 磁盘实况，产出「精确丢失清单」
 *  2) 把「在盘但未注册」的会话合并回 workspace.json 对应工作区 sessionIds
 * 安全：先整文件复制备份；只新增，不删除任何现有条目；原子写（tmp→rename）。
 */
import { readFile, writeFile, readdir, stat, copyFile, rename } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = 'C:/Users/73618/.dsh/sessions'
const WSF = 'C:/Users/73618/.dsh/storages/workspace.json'
const CACHE = 'C:/Users/73618/.dsh/storages/session_projcache.json'
const norm = (id) => id.replace(/^session-/, '')

const cache = JSON.parse(await readFile(CACHE, 'utf8'))
const cacheRows = {}
for (const [k, v] of Object.entries(cache.tables.sessions)) {
  cacheRows[norm(k)] = { title: v.rows?.title?.val ?? null, cwd: v.identity?.cwd ?? '?', createdAt: v.identity?.createdAt ?? 0 }
}

// 磁盘实况
const disk = new Map() // normId -> {proj, dirName}
function slugToName(slug) {
  return slug.replace(/~([0-9a-fA-F]{4})(?=~|-)/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/^-+D-dsh-+/, '').replace(/[-~]+$/, '') || slug
}
for (const p of await readdir(ROOT, { withFileTypes: true })) {
  if (!p.isDirectory()) continue
  for (const s of await readdir(join(ROOT, p.name), { withFileTypes: true })) {
    if (!s.isDirectory()) continue
    try { await stat(join(ROOT, p.name, s.name, 'session.jsonl.zstd')) } catch { continue }
    disk.set(norm(s.name), { proj: slugToName(p.name), dirName: s.name })
  }
}

// 1) 丢失清单 = 缓存认识但磁盘没有
const lost = Object.entries(cacheRows).filter(([id]) => !disk.has(id)).map(([id, r]) => ({ id, title: r.title, cwd: r.cwd, created: new Date(r.createdAt).toISOString().slice(0, 10) }))
// 2) 在盘未注册
const ws = JSON.parse(await readFile(WSF, 'utf8'))
const registered = new Set()
for (const w of Object.values(ws.tables.workspaces)) for (const sid of w.sessionIds ?? []) registered.add(norm(sid))
const unregistered = [...disk.keys()].filter((id) => !registered.has(id))

// 工作区按 path 匹配（项目目录 → workspace 条目）
const wsByLeaf = {}
for (const [wid, w] of Object.entries(ws.tables.workspaces)) {
  const leaf = w.path.replace(/[\\/]+$/, '').split(/[\\/]/).pop()
  wsByLeaf[leaf] = { wid, w }
}
const addedByWs = {}
for (const id of unregistered) {
  const proj = disk.get(id).proj
  const target = wsByLeaf[proj] ?? wsByLeaf['技术问题解决']
  if (!target) continue
  const fullId = disk.get(id).dirName
  const list = (target.w.sessionIds ??= [])
  if (!list.includes(fullId)) { list.push(fullId); addedByWs[target.w.title] = (addedByWs[target.w.title] ?? 0) + 1 }
}

if (lost.length) {
  console.log('=== 确认丢失（缓存有记录、磁盘已无文件、不可恢复）===')
  for (const l of lost) console.log(`  [${l.cwd}] ${l.title ?? '(无题)'}  created=${l.created}`)
} else {
  console.log('=== 缓存对照未发现丢失（缓存可能未覆盖全部历史会话，见注）===')
}
console.log(`\n=== 重新注册回工作区：${JSON.stringify(addedByWs)}（共 ${unregistered.length} 个）===`)

await copyFile(WSF, WSF + '.bak-reregain-' + new Date().toISOString().replace(/[:.]/g, '').slice(0, 15))
await writeFile(WSF + '.tmp', JSON.stringify(ws, null, 2))
await rename(WSF + '.tmp', WSF)
console.log('workspace.json 已原子写回（备份 .bak-reregain-*）')
