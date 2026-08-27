// 探针：验证「面板配置的 DSH 模型」经 claude-agent-sdk 跑通时，CLI 工具能力是否完整保留
// 用法：node _probe-claude-tools.mjs <modelId>
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

var sdkUrl = 'file:///C:/Users/73618/.dsh/profiles/web/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs'
var MODEL = process.argv[2] || 'deepseek-v4-flash'
var SANDBOX = 'C:\\Users\\73618\\AppData\\Local\\Temp\\cc-tool-probe'

mkdirSync(SANDBOX, { recursive: true })
writeFileSync(SANDBOX + '\\demo.json', JSON.stringify({ project: 'multi-role-debate', roles: ['codex', 'claude', 'judge'] }, null, 2))
writeFileSync(SANDBOX + '\\note.txt', '工具能力探针 by dsh-claude-agent')

var mod = await import(sdkUrl)
var sessionId = randomUUID()
var modelSeen = null
var toolCalls = []
var textOut = ''

var q = mod.query({
  prompt: '请先用你的文件读取工具读取当前目录下的 demo.json，然后回答两件事：1) project 字段的值；2) roles 数组里的第 2 个元素是什么。',
  options: {
    cwd: SANDBOX,
    sessionId: sessionId,
    persistSession: true,
    maxTurns: 8,
    model: MODEL,
    allowedTools: ['Read'],
    env: Object.assign({}, process.env, {
      ANTHROPIC_MODEL: MODEL,
      ANTHROPIC_DEFAULT_SONNET_MODEL: MODEL,
      ANTHROPIC_DEFAULT_OPUS_MODEL: MODEL,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: MODEL,
    }),
  },
})

for await (var m of q) {
  if (m.type === 'system' && m.subtype === 'init') { modelSeen = m.model || null }
  if (m.type === 'assistant' && m.message) {
    var content = m.message.content || []
    for (var b of content) {
      if (b.type === 'tool_use') toolCalls.push(b.name)
      if (b.type === 'text') textOut += b.text
    }
  }
}

console.log('=== 探针结果 ===')
console.log('配置模型    : ' + MODEL)
console.log('init 实际模型: ' + (modelSeen || '(未捕获)'))
console.log('工具调用    : ' + (toolCalls.length ? toolCalls.join(' -> ') : '(无)'))
console.log('--- 回答 ---')
console.log(textOut.slice(0, 300))
