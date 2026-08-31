/**
 * incident-recovery 批量技能恢复安装器 → C:\Users\73618\.dsh\skills\
 * 原则：只创建/覆盖 .dsh\skills 下的目标技能目录（该目录现为空壳），绝不删其他路径。
 * 幂等：重复运行覆盖同名目标。
 */
import { cp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

const DST = 'C:/Users/73618/.dsh/skills'
const SRC = 'D:/dsh/技术问题解决/incident-recovery/skills-src'
const REBUILT = 'D:/dsh/技术问题解决/incident-recovery/rebuilt'
const WRITES = 'D:/dsh/技术问题解决/incident-recovery/writes'
const idx = JSON.parse(await readFile('D:/dsh/技术问题解决/incident-recovery/skill-index.json', 'utf8'))
const report = {}

async function copyTree(from, to) {
  await rm(to, { recursive: true, force: true }) // 仅技能自身目录（新目录下）
  await cp(from, to, { recursive: true })
}

/** 替换/注入 frontmatter 的 name/description（description 用 YAML 字面块，兼容任意字符） */
async function patchFrontmatter(skillDir, name, desc) {
  const p = join(DST, skillDir, 'SKILL.md')
  let body = await readFile(p, 'utf8')
  const m = body.match(/^---\n([\s\S]*?)\n---\n?/)
  if (m) body = body.slice(m[0].length)
  const fm = ['---', `name: ${name}`]
  if (desc) fm.push('description: |-', ...desc.split('\n').map((l) => '  ' + l))
  fm.push('---', '')
  await writeFile(p, fm.join('\n') + body)
}

// ---------- 1) law-student × 13（官方 claude-for-legal 正文 + 用户中文触发描述） ----------
const LAW = {
  'case-brief': '以你偏好的格式做案例摘要。追问型模式让学生先陈述裁判要旨。当用户说"摘要[案例]"、"裁判要旨是什么"、"案例摘要"或粘贴裁判文书时触发。',
  'cold-call-prep': '为课堂提问做准备——预测老师可能提出的问题并以追问方式进行练习，标记你的薄弱环节，让你知道课前需要重新复习什么。当用户说"准备明天的课""课堂提问 [案例]""[老师]可能会问什么"或指向某篇阅读材料时使用。',
  'cold-start-interview': '关于你的访谈和材料摄入——年级、法考目标、学习风格（追问型vs讲解型）、以往大纲、评分作业、历年试题、法考真题集、教学大纲、论文。首次安装时使用，当用户说"设置"或"开始使用"时触发，或使用--check-integrations重新探测连接器。',
  'customize': '引导式调整你的学习设定——修改一项配置，无需重新运行完整的冷启动访谈。调整当前课程、学习风格、大纲偏好、法考备考科目、种子材料或学习会话节奏。当用户说"修改我的……""添加一门课""更新画像""新学期"或想调整配置时使用。',
  'exam-forecast': '分析同一教师的历年试题以揭示模式——科目权重、反复出现的高频考点、偏好的假设类型、政策vs法条比例——并预测考试重点。当用户说"考试考什么"、"分析历年试题"、"预测考试"或分享历年试题时触发。',
  'flashcards': '生成或练习记忆卡片，用于法律概念的记忆——Leitner间隔重复桶机制，按科目存储为markdown文件，支持带自我评估的练习模式。当用户说"练习记忆卡片""从……生成卡片""考我卡片"或想记忆法律概念时使用。',
  'irac-practice': '评析案例分析写作——结构、争议焦点、法条准确性、分析深度和逻辑组织。不代写、不展示标准答案；追踪跨会话模式。当用户说"评析我的案例分析"、"检查我的写作"或"我写了这个，给反馈"时触发。',
  'legal-writing': '对法律写作草稿的结构性反馈（法律意见书、代理词、辩护词、论文、考试论述）——逻辑组织、分析深度、清晰度、引用格式。绝不代写。当用户说"反馈我的法律意见书"、"读我的草稿"或"批评我的代理词"时触发。',
  'outline-builder': '从课堂笔记和教材构建或扩展课程知识体系，以你的格式。搭脚手架——不为你写大纲。当用户说"构建[科目]大纲"、"扩展我的知识体系"、"从[材料]构建大纲"或指向课堂材料时触发。',
  'session': '在某个科目上进行集中N题学习会话——客观题、主观题或记忆卡片。追踪成绩并更新学习计划。当用户说"给我10道刑法题"、"来一个民法会话"、"做5张宪法卡片"、或想练习固定数量的题目并让计划随之调整时使用。用法：`/law-student:session <科目> <N> [--客观题 | --主观题 | --记忆卡片]`，如 `刑法 10 --客观题`。',
  'socratic-drill': '苏格拉底式追问——它问，你答，它推回。不给你答案直到你挣到它。当用户说"追问我"、"测试我"、"苏格拉底式"、"考我[科目]"或想要主动学习时触发。',
  'study-plan': '制定或更新法考（或其它法律考试）长期备考计划——分阶段、按弱科加权分配科目、每日学习排程、根据 study-plan.yaml 中的学习记录自适应调整。当用户说"制定学习计划"、"安排法考备考"、"备考计划"、"怎么复习法考"时触发。',
  'bar-prep-questions': '法考题目练习——客观题（单选/多选/不定项）或主观题（案例分析/论述/法律文书），针对弱科和法考大纲生成，跟踪错题并回溯模式规律。**绝不直接展示标准答案——学生先作答，插件后点评。** 当用户说"法考刷题"、"来几道客观题"、"练习主观题"、"刑法多选题"、"法考测试"时触发。支持直接指定科目和题型：如 `刑法 --客观题`、`民法 --主观题`、`刑法 --session 10`。',
}
for (const [x, desc] of Object.entries(LAW)) {
  await copyTree(join(SRC, 'claude-for-legal/law-student/skills', x), join(DST, `law-student-${x}`))
  await patchFrontmatter(`law-student-${x}`, `law-student-${x}`, desc)
  report[`law-student-${x}`] = 'official repo + user trigger desc'
}

// ---------- 2) video 三件套 ----------
for (const v of ['download-video', 'narrate-video', 'transcribe-video']) {
  await copyTree(join(SRC, 'video-skills/skills', v), join(DST, v))
  report[v] = 'feiskyer/video-skills'
}

// ---------- 3) find-skills / huashu-nuwa ----------
await copyTree(join(SRC, 'vercel-skills/skills/find-skills'), join(DST, 'find-skills'))
report['find-skills'] = 'vercel-labs/skills'
await copyTree(join(SRC, 'nuwa-skill'), join(DST, 'huashu-nuwa'))
report['huashu-nuwa'] = 'hkxiaoyao/nuwa-skill (name+desc 与 DSH 目录逐字一致)'

// ---------- 4) camoufox-2026（官方 Bin-Huang 正文 + 用户触发描述） ----------
await copyTree(join(SRC, 'camoufox-cli/skills/camoufox-cli'), join(DST, 'camoufox-2026'))
await patchFrontmatter('camoufox-2026', 'camoufox-2026',
  'Anti-detect stealth browser automation using Camoufox (Firefox-based, C++-level fingerprint spoofing). Use this skill for ANY browser automation that must avoid bot detection — social media logins, persistent sessions, humanized interaction, or scraping protected sites. Covers 2026-current Camoufox API, known instability warnings, async/sync patterns, persistent context, and humanization config. ALWAYS use this over raw Playwright when stealth is required.')
report['camoufox-2026'] = 'Bin-Huang/camoufox-cli official body + user desc (近似恢复)'

// ---------- 5) playwright（playwright-core 自带 skill + 用户描述） ----------
await copyTree('D:/dsh/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/lib/tools/cli-client/skill', join(DST, 'playwright'))
await patchFrontmatter('playwright', 'playwright',
  'Use when the task requires automating a real browser from the terminal (navigation, form filling, snapshots, screenshots, data extraction, UI-flow debugging) via `playwright-cli` or the bundled wrapper script.')
report['playwright'] = 'playwright-core bundled skill + user desc'

// ---------- 6) 从日志挖回的文件安装 ----------
// 6a) dsh-plugin-development / dsh-plugin-publish：write 全文，按索引原始 rel 还原目录结构
for (const name of ['dsh-plugin-development', 'dsh-plugin-publish']) {
  const entry = idx.hits[name]
  if (!entry?.writeFiles?.length) { report[name] = 'NO WRITE FILES IN INDEX'; continue }
  const dir = join(DST, name)
  await rm(dir, { recursive: true, force: true })
  for (const wf of entry.writeFiles) {
    const [rel, rest] = [wf.split('#')[0], wf.slice(wf.indexOf('#') + 1)]
    const seq = rest.split('(')[0]
    const safe = rel.replace(/[^\w.-]+/g, '_')
    const sidecar = join(WRITES, `${seq.padStart(9, '0')}__${name}__${safe}`)
    const content = await readFile(sidecar)
    const dest = join(dir, ...rel.split('/'))
    await mkdir(join(dest, '..'), { recursive: true })
    await writeFile(dest, content)
  }
  report[name] = `mined from session writes (${entry.writeFiles.length} files)`
}
// 6b) computer-use / skill-creator：skill-load 信封剥壳 + 用户描述
async function installFromLoad(name, desc) {
  const src = join(REBUILT, name, 'SKILL.md')
  let raw
  try { raw = await readFile(src, 'utf8') } catch { report[name] = 'NO LOAD FILE'; return }
  const instr = raw.match(/<skill_instructions>([\s\S]*?)<\/skill_instructions>/)
  const body = (instr ? instr[1] : raw).trim() + '\n'
  const dir = join(DST, name)
  await mkdir(dir, { recursive: true })
  const fm = ['---', `name: ${name}`, 'description: |-', ...desc.split('\n').map((l) => '  ' + l), '---', ''].join('\n')
  await writeFile(join(dir, 'SKILL.md'), fm + body)
  report[name] = 'mined from skill-load result (envelope stripped) — 可能不含附属文件'
}
await installFromLoad('computer-use',
  "Use Orca's computer-use CLI to inspect and operate local desktop app windows through accessibility trees, screenshots, and safe UI actions. Use for desktop app interaction: list apps/windows, get app state, read visible UI, click controls, type, press keys, scroll, drag, set values, or perform accessibility actions. Also use for browser windows, webviews, Orca app UI, or other desktop UI.")
await installFromLoad('skill-creator',
  '构建、创建或修改 DSH 技能的全局元技能。当用户说"构建一个技能 / 创建技能 / 把这个经验封装成技能 / 做成可复用技能"，或要求新建、改进任何 SKILL.md 技能时使用。按渐进披露方法论产出规范技能：精简 SKILL.md + references 深文档 + scripts 确定性工具。')

console.log(JSON.stringify(report, null, 2))
