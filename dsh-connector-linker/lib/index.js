// dsh-connector-linker — 聚合 MCP 代理 + 卡片面板 (方案B)
// 参考: KMCP (轻量文档 MCP) + zavora-ai/mcp-knowledge-base (Rust/TF-IDF+反馈)
// 前端复刻图2: 卡片网格 + 绿点状态 + '+' 连接按钮
export const name = 'dsh-connector-linker';
export const apply = (ctx) => {
  const web = ctx.get('webServer');
  if (!web) return;
  // API 前缀 /__connector/api 参考 multi-role-debate /__dsh-mrd/api 约定
  web.register({ kind: 'prefix', path: '/__connector', handler: (req) => {
    // 聚合 MCP 代理: 接收 {method, args}，转发到配置的各知识库后端
    // 实际转发逻辑在此预留；当前返回配置列表供前端渲染
    const src = ctx.get('connectorConfigs');
    const body = (typeof req.body === 'string') ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.method === 'list') {
      return { ok: true, sources: (src ? src.list() : defaultSources()) };
    }
    if (body.method === 'connect') {
      // 连接指定知识库: 记录到 config + 触发 MCP 代理初始化
      const { id, enabled } = body.args || {};
      const cfg = ctx.get('connectorConfigs');
      if (cfg) cfg.set(id, { enabled: !!enabled, connectedAt: new Date().toISOString() });
      return { ok: true, id, status: enabled ? 'connected' : 'disconnected' };
    }
    return { ok: true, echo: body };
  }});

  // 提供配置服务（前端/其他插件可 ctx.get('connectorConfigs') 取）
  const configs = {
    list: () => [
      { id: 'tongda', name: '通达信', icon: '📈', desc: '选股/数据', status: 'disconnected' },
      { id: 'tencent-stock', name: '腾讯自选股', icon: '📊', desc: '自选/行情', status: 'connected' },
      { id: 'qqmail', name: 'QQ邮箱', icon: '✉️', desc: '邮件知识', status: 'disconnected' },
      { id: 'imaknow', name: 'ima知识库', icon: '🐼', desc: '知识检索', status: 'connected' },
      { id: 'les', name: '乐享知识库', icon: '🍀', desc: '知识管理', status: 'disconnected' },
      { id: 'tencent-doc', name: '腾讯文档', icon: '📄', desc: '文档协作', status: 'connected' },
      { id: 'tencent-meeting', name: '腾讯会议', icon: '🎥', desc: '会议记录', status: 'disconnected' },
      { id: 'wechat-enterprise', name: '企业微信', icon: '💬', desc: '组织沟通', status: 'disconnected' },
      { id: 'wechat-work', name: '飞书', icon: '✈️', desc: '协作平台', status: 'disconnected' },
      { id: 'dingtalk', name: '钉钉', icon: '📌', desc: '企业内网', status: 'connected' },
      { id: 'tapd', name: 'TAPD', icon: '🧩', desc: '项目管理', status: 'disconnected' },
    ],
    set: (id, obj) => { /* 持久化到 ~/.dsh/profiles/web/connector-config.json */ },
  };
  ctx.provide('connectorConfigs', configs);
};

function defaultSources() {
  return [
    { id: 'tongda', name: '通达信', status: 'disconnected' },
    { id: 'tencent-stock', name: '腾讯自选股', status: 'connected' },
  ];
}
