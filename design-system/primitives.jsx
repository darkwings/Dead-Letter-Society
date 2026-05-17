/* global React */
// Dead Letter Society — shared primitives + icons
// All components are stateless display pieces unless noted.

// ─────────── Icons (1px stroke, 14px box) ───────────
const Icon = ({ d, size = 14, stroke = 1.5, fill = 'none', children, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} stroke="currentColor"
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    {d ? <path d={d} /> : children}
  </svg>
);
const I = {
  search: (p) => <Icon {...p} d="M7 12.5A5.5 5.5 0 1 0 7 1.5a5.5 5.5 0 0 0 0 11ZM14.5 14.5l-3.6-3.6" />,
  bell: (p) => <Icon {...p} d="M3.5 11.5h9l-1-1.5V7a3.5 3.5 0 0 0-7 0v3l-1 1.5ZM6.5 13.5a1.5 1.5 0 0 0 3 0" />,
  inbox: (p) => <Icon {...p}><path d="M2 9.5v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" /><path d="M2 9.5 4 3a1 1 0 0 1 1-.7h6a1 1 0 0 1 1 .7l2 6.5" /><path d="M2 9.5h3l1 2h4l1-2h3" /></Icon>,
  layers: (p) => <Icon {...p}><path d="m2 5 6-3 6 3-6 3-6-3Z" /><path d="m2 8 6 3 6-3" /><path d="m2 11 6 3 6-3" /></Icon>,
  settings: (p) => <Icon {...p}><circle cx="8" cy="8" r="2" /><path d="M8 1v2M8 13v2M14 8h-2M3 8H1M12 4l-1.4 1.4M5.4 10.6 4 12M12 12l-1.4-1.4M5.4 5.4 4 4" /></Icon>,
  play: (p) => <Icon {...p} fill="currentColor" stroke="none"><path d="M4 3v10l9-5L4 3Z" /></Icon>,
  refresh: (p) => <Icon {...p}><path d="M14 7A6 6 0 0 0 3 4M2 9a6 6 0 0 0 11 3" /><path d="M14 2v4h-4M2 14v-4h4" /></Icon>,
  filter: (p) => <Icon {...p} d="M2 3h12l-4.5 6v4l-3 1.5V9L2 3Z" />,
  download: (p) => <Icon {...p}><path d="M8 2v8M5 7l3 3 3-3" /><path d="M3 12v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" /></Icon>,
  copy: (p) => <Icon {...p}><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" /></Icon>,
  check: (p) => <Icon {...p} d="m3 8 3 3 7-7" />,
  x: (p) => <Icon {...p} d="m3.5 3.5 9 9M12.5 3.5l-9 9" />,
  chevron: (p) => <Icon {...p} d="m5 3 5 5-5 5" />,
  chevronDown: (p) => <Icon {...p} d="m3 5 5 5 5-5" />,
  chevronUp: (p) => <Icon {...p} d="m3 11 5-5 5 5" />,
  more: (p) => <Icon {...p} fill="currentColor" stroke="none"><circle cx="3.5" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="12.5" cy="8" r="1.2" /></Icon>,
  plus: (p) => <Icon {...p} d="M8 2v12M2 8h12" />,
  warn: (p) => <Icon {...p}><path d="m8 2 7 12H1L8 2Z" /><path d="M8 6.5v3.5M8 12v.5" /></Icon>,
  info: (p) => <Icon {...p}><circle cx="8" cy="8" r="6.5" /><path d="M8 7v4M8 4.5v.5" /></Icon>,
  err: (p) => <Icon {...p}><circle cx="8" cy="8" r="6.5" /><path d="m5.5 5.5 5 5M10.5 5.5l-5 5" /></Icon>,
  ok: (p) => <Icon {...p}><circle cx="8" cy="8" r="6.5" /><path d="m5 8 2 2 4-4" /></Icon>,
  pkg: (p) => <Icon {...p}><path d="m2 4.5 6-3 6 3v7l-6 3-6-3v-7Z" /><path d="m2 4.5 6 3 6-3M8 7.5V14.5" /></Icon>,
  user: (p) => <Icon {...p}><circle cx="8" cy="6" r="2.5" /><path d="M3 14a5 5 0 0 1 10 0" /></Icon>,
  lock: (p) => <Icon {...p}><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></Icon>,
  globe: (p) => <Icon {...p}><circle cx="8" cy="8" r="6.5" /><path d="M2 8h12M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13" /></Icon>,
  command: (p) => <Icon {...p}><path d="M5 2v12M11 2v12M2 5h12M2 11h12" /></Icon>,
  drag: (p) => <Icon {...p} fill="currentColor" stroke="none"><circle cx="6" cy="4" r="1" /><circle cx="10" cy="4" r="1" /><circle cx="6" cy="8" r="1" /><circle cx="10" cy="8" r="1" /><circle cx="6" cy="12" r="1" /><circle cx="10" cy="12" r="1" /></Icon>,
  trash: (p) => <Icon {...p}><path d="M3 4.5h10M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 4.5v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-8" /></Icon>,
  edit: (p) => <Icon {...p} d="M11 2.5 13.5 5 5.5 13 2 14l1-3.5 8-8Z" />,
  zap: (p) => <Icon {...p} d="M9 1 3 9h4l-1 6 6-8H8l1-6Z" />,
  ticket: (p) => <Icon {...p}><path d="M2 5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2a1.5 1.5 0 0 0 0 3v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a1.5 1.5 0 0 0 0-3V5Z" /></Icon>,
  database: (p) => <Icon {...p}><ellipse cx="8" cy="3.5" rx="5.5" ry="2" /><path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" /></Icon>,
  spinner: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ animation: 'dls-spin 0.8s linear infinite' }}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  arrowRight: (p) => <Icon {...p} d="M3 8h10M9 4l4 4-4 4" />,
};

// inject spin keyframes once
if (typeof document !== 'undefined' && !document.getElementById('dls-anim')) {
  const s = document.createElement('style'); s.id = 'dls-anim';
  s.textContent = '@keyframes dls-spin{to{transform:rotate(360deg)}}@keyframes dls-pulse{0%,100%{opacity:.45}50%{opacity:1}}@keyframes dls-blink{0%,49%{opacity:1}50%,100%{opacity:0}}';
  document.head.appendChild(s);
}

// ─────────── Badge ───────────
const STATUS_LABEL = {
  NEW: 'NEW',
  UNDER_REVIEW: 'UNDER REVIEW',
  REPLAYED: 'REPLAYED',
  DISCARDED: 'DISCARDED',
  REPLAY_FAILED: 'REPLAY FAILED',
};
const STATUS_CLASS = {
  NEW: 's-new',
  UNDER_REVIEW: 's-under-review',
  REPLAYED: 's-replayed',
  DISCARDED: 's-discarded',
  REPLAY_FAILED: 's-replay-failed',
};
const StatusBadge = ({ status, dot = true, size }) => (
  <span className={`badge ${STATUS_CLASS[status]}`} style={size === 'lg' ? { height: 22, fontSize: 11, padding: '0 9px' } : undefined}>
    {dot && <span className="badge-dot" />}
    {STATUS_LABEL[status]}
  </span>
);
const RoleBadge = ({ role }) => (
  <span className={`badge role-${role.toLowerCase()}`}>{role}</span>
);

// ─────────── Button ───────────
const Btn = ({ variant = 'secondary', size, icon, children, disabled, onClick, style, title }) => (
  <button className={`btn btn-${variant}${size ? ' btn-' + size : ''}`} disabled={disabled} onClick={onClick} style={style} title={title}>
    {icon}
    {children}
  </button>
);

// ─────────── Kbd row ───────────
const Kbd = ({ children }) => <span className="kbd">{children}</span>;

// ─────────── Avatar ───────────
const Avatar = ({ initials = 'JK', size = 24, hue = 258 }) => (
  <div style={{
    width: size, height: size, borderRadius: 999,
    background: `hsl(${hue} 40% 30%)`,
    color: `hsl(${hue} 60% 88%)`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.42, fontWeight: 600, letterSpacing: 0,
    border: `1px solid hsl(${hue} 50% 40% / 0.5)`,
    flexShrink: 0,
  }}>{initials}</div>
);

// ─────────── Top bar ───────────
const TopBar = ({ env = 'prod-us-east-1' }) => (
  <div style={{
    height: 44, display: 'flex', alignItems: 'center', gap: 16,
    padding: '0 14px', borderBottom: '1px solid hsl(var(--border))',
    background: 'hsl(var(--background))',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Logo size={18} />
      <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: -0.01 }}>Dead Letter Society</span>
    </div>
    <div style={{ width: 1, height: 18, background: 'hsl(var(--border))' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
      <I.database size={12} />
      <span className="mono">{env}</span>
      <I.chevron size={10} />
    </div>
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 6, maxWidth: 360, marginLeft: 8,
      padding: '4px 10px', background: 'hsl(var(--muted) / 0.5)',
      border: '1px solid hsl(var(--border))', borderRadius: 6,
      color: 'hsl(var(--muted-foreground))', fontSize: 12,
    }}>
      <I.search size={12} />
      <span>Search messages, configs, offsets…</span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 3 }}>
        <Kbd>⌘</Kbd><Kbd>K</Kbd>
      </span>
    </div>
    <div style={{ flex: 1 }} />
    <button className="btn-ghost btn" style={{ width: 28, padding: 0, position: 'relative' }}>
      <I.bell size={14} />
      <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 999, background: 'hsl(var(--status-replay-failed))' }} />
    </button>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar initials="JK" />
    </div>
  </div>
);

const Logo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.6" strokeLinejoin="round">
    {/* envelope with skull-ish slit, abstract */}
    <rect x="2.5" y="5.5" width="19" height="13" rx="1.5" />
    <path d="m2.5 6.5 9.5 7 9.5-7" />
    <circle cx="12" cy="14" r="1.2" fill="hsl(var(--primary))" stroke="none" />
  </svg>
);

// ─────────── Sidebar item ───────────
const SidebarItem = ({ icon, label, count, active, muted }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 8px', borderRadius: 5, fontSize: 12.5,
    background: active ? 'hsl(var(--primary) / 0.12)' : 'transparent',
    color: active ? 'hsl(var(--foreground))' : (muted ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground) / 0.85)'),
    cursor: 'pointer',
    border: active ? '1px solid hsl(var(--primary) / 0.25)' : '1px solid transparent',
  }}>
    {icon}
    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    {count != null && (
      <span style={{
        fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999,
        background: count > 0 ? 'hsl(var(--primary) / 0.18)' : 'hsl(var(--muted))',
        color: count > 0 ? 'hsl(var(--primary) / 0.95)' : 'hsl(var(--muted-foreground))',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 16, textAlign: 'center',
      }} className="mono">{count}</span>
    )}
  </div>
);

// ─────────── JSON viewer ───────────
const JSONView = ({ data, showLineNumbers = true, copyable = true, height = 220 }) => {
  const lines = React.useMemo(() => renderJSON(data, 0).split('\n'), [data]);
  return (
    <div style={{ position: 'relative', background: 'hsl(var(--code-bg))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', height, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid hsl(var(--border))', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
        <span className="mono">payload.json · {bytesOf(data)} B</span>
        {copyable && (
          <button className="btn btn-ghost btn-sm" style={{ height: 18, padding: '0 6px', fontSize: 10 }}>
            <I.copy size={11} /> Copy
          </button>
        )}
      </div>
      <div className="json scroll" style={{ padding: '8px 4px 8px 4px', overflow: 'auto', height: height - 32 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', whiteSpace: 'pre' }}>
            {showLineNumbers && <span className="ln mono">{i + 1}</span>}
            <span dangerouslySetInnerHTML={{ __html: l }} />
          </div>
        ))}
      </div>
    </div>
  );
};
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function renderJSON(v, indent) {
  const pad = '  '.repeat(indent);
  if (v === null) return `<span class="u">null</span>`;
  if (typeof v === 'boolean') return `<span class="b">${v}</span>`;
  if (typeof v === 'number') return `<span class="n">${v}</span>`;
  if (typeof v === 'string') return `<span class="s">"${esc(v)}"</span>`;
  if (Array.isArray(v)) {
    if (v.length === 0) return `<span class="p">[]</span>`;
    return `<span class="p">[</span>\n` + v.map(x => `${pad}  ${renderJSON(x, indent + 1)}`).join(`<span class="p">,</span>\n`) + `\n${pad}<span class="p">]</span>`;
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return `<span class="p">{}</span>`;
    return `<span class="p">{</span>\n` + keys.map(k => `${pad}  <span class="k">"${esc(k)}"</span><span class="p">:</span> ${renderJSON(v[k], indent + 1)}`).join(`<span class="p">,</span>\n`) + `\n${pad}<span class="p">}</span>`;
  }
  return esc(String(v));
}
function bytesOf(v) { try { return JSON.stringify(v).length; } catch { return 0; } }

// ─────────── Toast ───────────
const Toast = ({ kind = 'success', title, body }) => {
  const K = {
    success: { icon: <I.ok />, color: 'var(--success)' },
    error: { icon: <I.err />, color: 'var(--destructive)' },
    warning: { icon: <I.warn />, color: 'var(--warning)' },
    info: { icon: <I.info />, color: 'var(--info)' },
  }[kind];
  return (
    <div style={{
      width: 320,
      background: 'hsl(var(--elevated))',
      border: '1px solid hsl(var(--border-strong))',
      borderLeft: `2px solid hsl(${K.color})`,
      borderRadius: 'var(--radius)',
      padding: '10px 12px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
      boxShadow: '0 8px 28px hsl(0 0% 0% / 0.4), 0 0 0 1px hsl(0 0% 0% / 0.2)',
    }}>
      <span style={{ color: `hsl(${K.color})`, marginTop: 1 }}>{K.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        {body && <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{body}</div>}
      </div>
      <button className="btn btn-ghost" style={{ width: 20, height: 20, padding: 0 }}><I.x size={12} /></button>
    </div>
  );
};

Object.assign(window, { I, Icon, Logo, StatusBadge, RoleBadge, Btn, Kbd, Avatar, TopBar, SidebarItem, JSONView, Toast, STATUS_LABEL, STATUS_CLASS });
