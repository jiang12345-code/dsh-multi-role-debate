// dsh-connector-linker client — 复刻图2 卡片面板
// 无 JSX，手写 React.createElement；CSS document.createElement('style')+appendChild（AGENTS.md L4）
module.exports = function init(ctx) {
  const React = window.React;
  const slots = ctx.get('slots');
  if (!slots) return;
  // 注入 conversation.view slot（参考 multi-role-debate client 位置）
  slots.inject('conversation.view', (slotProps) => {
    // 实际渲染用 createElement；以下为简化结构，展示卡片网格
    return React.createElement('div', { className: 'connector-linker-panel', style: panelStyle },
      React.createElement('header', { style: headerStyle },
        React.createElement('h3', { style: titleStyle }, '链接器 • MCP 连接外部知识库'),
        React.createElement('span', { style: subStyle }, '参考图2 · 聚合代理 (方案B)')
      ),
      React.createElement('div', { style: gridStyle },
        ['通达信','腾讯自选股','QQ邮箱','ima知识库','乐享知识库','腾讯文档','腾讯会议','企业微信','飞书','� expresa 标签']
          .map((n, i) => React.createElement(Card, { key: n, name: n, status: i % 3 === 1 ? 'connected' : 'disconnected', desc: '知识源' }))
      ),
      React.createElement('div', { style: noteStyle }, '聚合 MCP 代理已注册 /__connector/api · 前端卡片映射参考 workbuddy-bridge')
    );
  });

  function Card({ name, status, desc }) {
    const green = status === 'connected';
    return React.createElement('div', { style: cardStyle(green) },
      React.createElement('div', { style: cardHeaderStyle },
        React.createElement('span', { style: avatarStyle }, name[0]),
        React.createElement('strong', { style: cardTitleStyle }, name),
        React.createElement('span', { style: greenDotStyle(green) }, green ? '●' : '○'),
        React.createElement('button', { style: btnStyle, onClick: () => { /* 连接/断开 */ } }, '+')
      ),
      React.createElement('p', { style: descStyle }, desc}
    );
  }

  // CSS 注入（AGENTS.md L4 规则：document.createElement('style')+head.appendChild）
  const styleEl = document.createElement('style');
  styleEl.textContent = `
.connector-linker-panel { background:#0d1117; color:#c9d1d9; font-family:system-ui,"DM Sans",sans-serif; padding:16px 20px; border:1px solid #30363d; border-radius:12px; }
.connector-linker-panel header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.connector-linker-panel h3 { margin:0; font-size:15px; letter-spacing:0.2px; }
.connector-linker-panel .sub { font-size:11px; color:#8b949e; }
`;
  document.head.appendChild(styleEl);
};

const panelStyle = { background: '#0d1117', color: '#c9d1d9', padding: 16, border: '1px solid #30363d', borderRadius: 12, fontFamily: 'system-ui,"DM Sans",sans-serif' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 };
const titleStyle = { margin: 0, fontSize: 15, letterSpacing: 0.2 };
const subStyle = { fontSize: 11, color: '#8b949e' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 };
const cardStyle = (g) => ({ background: '#161b22', border: '1px solid ' + (g ? '#238636' : '#30363d'), borderRadius: 10, padding: 12, transition: 'border-color .2s' });
const cardHeaderStyle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 };
const avatarStyle = { width: 28, height: 28, borderRadius: '50%', background: g => g ? '#238636' : '#30363d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', flexShrink: 0 };
const cardTitleStyle = { fontSize: 13, color: '#f0f6fc', flex: 1 };
const greenDotStyle = (g) => ({ fontSize: 14, color: g ? '#3fb950' : '#8b949e', marginLeft: 4 });
const btnStyle = { marginLeft: 6, padding: '2px 8px', border: '1px solid #8b949e', background: 'transparent', color: '#c9d1d9', borderRadius: 6, cursor: 'pointer', fontSize: 12 };
const descStyle = { fontSize: 11, color: '#8b949e', margin: 0 };
const noteStyle = { marginTop: 12, fontSize: 11, color: '#8b949e', borderTop: '1px solid #30363d', paddingTop: 8 };
