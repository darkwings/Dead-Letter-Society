/* global React, StatusBadge, RoleBadge, Btn, I, Avatar, SidebarItem, JSONView, Toast, Kbd, TopBar, Logo */

// ════════════════════════════════════════════════════════════
//  Shared chrome: Sidebar
// ════════════════════════════════════════════════════════════
const Sidebar = ({ active = 'orders' }) => {
  const configs = [
    { id: 'orders', name: 'orders.dlq', count: 12, env: 'prod-us' },
    { id: 'payments', name: 'payments.dlq', count: 3, env: 'prod-us' },
    { id: 'notify', name: 'notify.email.dlq', count: 0, env: 'prod-us' },
    { id: 'inventory', name: 'inventory.sync.dlq', count: 47, env: 'prod-eu' },
    { id: 'auth', name: 'auth.events.dlq', count: 0, env: 'prod-eu' },
    { id: 'tracking', name: 'tracking.dlq', count: 1, env: 'staging' },
  ];
  return (
    <div style={{
      width: 220, flexShrink: 0,
      borderRight: '1px solid hsl(var(--border))',
      background: 'hsl(var(--card) / 0.4)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 12px 8px' }}>
        <SidebarItem icon={<I.inbox size={13} />} label="Overview" />
        <SidebarItem icon={<I.layers size={13} />} label="All messages" muted />
        <SidebarItem icon={<I.command size={13} />} label="Activity" muted />
      </div>
      <div style={{ padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="t-h4">DLQ Configs</span>
        <button className="btn btn-ghost" style={{ width: 20, height: 20, padding: 0 }}><I.plus size={11} /></button>
      </div>
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 1, flex: 1, overflow: 'auto' }} className="scroll">
        {configs.map(c => (
          <SidebarItem
            key={c.id}
            icon={<span style={{ width: 8, height: 8, borderRadius: 2, background: c.count > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)' }} />}
            label={c.name}
            count={c.count}
            active={c.id === active}
          />
        ))}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SidebarItem icon={<I.settings size={13} />} label="Cluster settings" muted />
        <SidebarItem icon={<I.user size={13} />} label="Members & roles" muted />
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  1. Dashboard
// ════════════════════════════════════════════════════════════
const ScreenDashboard = () => (
  <div className="dls" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <TopBar />
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <Sidebar active={null} />
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 26px' }} className="scroll">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
          <div>
            <div className="t-h1">Overview</div>
            <div className="t-small">6 DLQ configs across 3 clusters · last fetch 38s ago</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" icon={<I.download size={12} />}>Export</Btn>
            <Btn variant="secondary" icon={<I.refresh size={12} />}>Fetch all</Btn>
          </div>
        </div>

        {/* summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 22 }}>
          <SummaryCard status="NEW" count={63} delta="+12" />
          <SummaryCard status="UNDER_REVIEW" count={28} delta="+3" />
          <SummaryCard status="REPLAYED" count={1247} delta="+184" period="7d" />
          <SummaryCard status="REPLAY_FAILED" count={9} delta="+2" alert />
          <SummaryCard status="DISCARDED" count={412} delta="" period="7d" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
          {/* throughput sparkline card */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div>
                <div className="t-h2">Inbound rate</div>
                <div className="t-small">Messages landing in DLQs · last 24h</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <span className="badge" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>24H</span>
                <span className="badge" style={{ background: 'transparent', color: 'hsl(var(--muted-foreground))', textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>7D</span>
                <span className="badge" style={{ background: 'transparent', color: 'hsl(var(--muted-foreground))', textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>30D</span>
              </div>
            </div>
            <Spark />
            <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              <Legend dotColor="var(--primary)" label="orders.dlq" /><Legend dotColor="var(--info)" label="payments.dlq" /><Legend dotColor="var(--warning)" label="inventory.sync.dlq" />
            </div>
          </div>

          {/* DLQ summary table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="t-h2">DLQ status</div>
              <div className="t-tiny mono">3 clusters</div>
            </div>
            <table className="table">
              <thead><tr><th>Config</th><th style={{ width: 60, textAlign: 'right' }}>New</th><th style={{ width: 60, textAlign: 'right' }}>Review</th><th style={{ width: 60, textAlign: 'right' }}>Failed</th></tr></thead>
              <tbody>
                {[
                  ['orders.dlq', 12, 4, 0],
                  ['payments.dlq', 3, 1, 1],
                  ['inventory.sync.dlq', 47, 22, 7],
                  ['notify.email.dlq', 0, 0, 0],
                  ['tracking.dlq', 1, 1, 1],
                ].map(([n, a, b, c]) => (
                  <tr key={n}>
                    <td className="mono" style={{ fontSize: 11.5 }}>{n}</td>
                    <td className="mono" style={{ textAlign: 'right', color: a > 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>{a}</td>
                    <td className="mono" style={{ textAlign: 'right', color: b > 0 ? 'hsl(var(--status-under-review))' : 'hsl(var(--muted-foreground))' }}>{b}</td>
                    <td className="mono" style={{ textAlign: 'right', color: c > 0 ? 'hsl(var(--status-replay-failed))' : 'hsl(var(--muted-foreground))' }}>{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div className="t-h2">Recent activity</div>
            <a className="t-small" style={{ color: 'hsl(var(--primary))', cursor: 'pointer' }}>View all →</a>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="row-divider">
              <ActivityRow when="00:42" who="j.kuo" what="replayed" detail="3 messages from orders.dlq to topic.orders" kind="success" />
              <ActivityRow when="00:38" who="system" what="fetch completed" detail="144 new messages from inventory.sync.dlq (prod-eu)" kind="info" />
              <ActivityRow when="00:31" who="m.rivera" what="discarded" detail="orders.dlq offset 1,284,201 — duplicate from retry storm" kind="muted" />
              <ActivityRow when="00:24" who="system" what="replay failed" detail="schema 1042 incompatible with topic.payments v3" kind="error" />
              <ActivityRow when="00:18" who="d.mendez" what="status changed" detail="orders.dlq offset 1,284,872 → UNDER_REVIEW" kind="info" />
              <ActivityRow when="00:09" who="system" what="new message" detail="orders.dlq partition 7 · offset 1,284,991" kind="muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SummaryCard = ({ status, count, delta, period = '24h', alert }) => (
  <div className="card" style={{ padding: 12, position: 'relative', overflow: 'hidden', borderColor: alert ? 'hsl(var(--destructive) / 0.35)' : undefined }}>
    {alert && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'hsl(var(--destructive))' }} />}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <StatusBadge status={status} />
      {delta && <span className="mono" style={{ fontSize: 10.5, color: alert ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))' }}>{delta} {period}</span>}
    </div>
    <div className="mono" style={{ fontSize: 26, fontWeight: 500, marginTop: 8, letterSpacing: -0.02, fontVariantNumeric: 'tabular-nums' }}>{count.toLocaleString()}</div>
  </div>
);

const ActivityRow = ({ when, who, what, detail, kind }) => {
  const colors = {
    success: 'var(--success)', error: 'var(--destructive)', info: 'var(--info)', muted: 'var(--muted-foreground)',
  };
  return (
    <div style={{ padding: '9px 14px', display: 'flex', gap: 12, alignItems: 'center', fontSize: 12.5 }}>
      <span className="mono" style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', width: 40 }}>{when}</span>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: `hsl(${colors[kind]})`, flexShrink: 0 }} />
      <span className="mono" style={{ width: 76, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>{who}</span>
      <span style={{ fontWeight: 500, width: 110 }}>{what}</span>
      <span style={{ color: 'hsl(var(--foreground) / 0.85)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>
    </div>
  );
};

const Legend = ({ dotColor, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ width: 8, height: 2, background: `hsl(${dotColor})` }} />
    <span className="mono">{label}</span>
  </span>
);

// little SVG sparkline area chart
const Spark = () => {
  const w = 700, h = 90, pad = 4;
  const series = [
    { color: 'var(--primary)', data: [3,2,4,3,5,7,6,8,7,9,11,8,6,5,7,9,12,10,11,14,18,12,10,7] },
    { color: 'var(--info)', data: [1,1,2,1,2,2,3,2,2,3,4,3,3,2,3,3,4,5,4,3,4,4,3,2] },
    { color: 'var(--warning)', data: [0,0,0,0,1,2,4,7,12,18,22,18,14,10,8,11,16,22,28,24,20,16,12,9] },
  ];
  const all = series.flatMap(s => s.data); const max = Math.max(...all);
  const n = series[0].data.length;
  const path = (data) => {
    const pts = data.map((v, i) => [pad + (i/(n-1))*(w-pad*2), h - pad - (v/max)*(h-pad*2)]);
    return 'M' + pts.map(p => p.join(' ')).join(' L ');
  };
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', marginTop: 8 }}>
      {[0.25, 0.5, 0.75].map(y => <line key={y} x1={0} x2={w} y1={h*y} y2={h*y} stroke="hsl(var(--border))" strokeDasharray="2 4" />)}
      {series.map((s, i) => (
        <g key={i}>
          <path d={`${path(s.data)} L ${w-pad} ${h-pad} L ${pad} ${h-pad} Z`} fill={`hsl(${s.color} / 0.08)`} />
          <path d={path(s.data)} fill="none" stroke={`hsl(${s.color})`} strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
};

// ════════════════════════════════════════════════════════════
//  2. Message List
// ════════════════════════════════════════════════════════════
const SAMPLE_MSGS = [
  { sel: false, st: 'NEW', ts: '14:42:03', part: 7, offset: 1284991, payload: '{"orderId":"ord_9k2j4m","customer":{"id":"u_q8k2j7","tier":"gold"},"items":[…],"total":4218}' },
  { sel: true, st: 'UNDER_REVIEW', ts: '14:28:11', part: 7, offset: 1284872, payload: '{"orderId":"ord_4p1x2n","customer":{"id":"u_a3b9c2"},"items":[…],"total":182}' },
  { sel: false, st: 'NEW', ts: '14:11:42', part: 3, offset: 1284791, payload: '{"orderId":"ord_7y8w3k","customer":{"id":"u_d4e1f8"},"items":[…],"total":1492}' },
  { sel: false, st: 'REPLAY_FAILED', ts: '13:54:09', part: 7, offset: 1284604, payload: '{"orderId":"ord_2k9m7r","schema":"v1.17","payload":"<binary>"}' },
  { sel: false, st: 'REPLAYED', ts: '13:42:00', part: 1, offset: 1284512, payload: '{"orderId":"ord_8j2l4p","customer":{"id":"u_x5n2m4"},"items":[…],"total":884}' },
  { sel: false, st: 'NEW', ts: '13:31:18', part: 3, offset: 1284401, payload: '{"orderId":"ord_5w8q1r","customer":{"id":"u_p7t6s2"},"items":[…],"total":56}' },
  { sel: false, st: 'UNDER_REVIEW', ts: '13:18:44', part: 5, offset: 1284390, payload: '{"orderId":"ord_3h6g9b","customer":{"id":"u_k1l8m9"},"items":[…],"total":2104}' },
  { sel: false, st: 'DISCARDED', ts: '12:55:02', part: 0, offset: 1284204, payload: '{"orderId":"ord_8d2f6h","duplicate_of":"ord_8d2f6h_orig"}' },
  { sel: false, st: 'REPLAYED', ts: '12:42:18', part: 2, offset: 1284188, payload: '{"orderId":"ord_1a4b7c","customer":{"id":"u_q3w2e8"},"items":[…],"total":920}' },
  { sel: false, st: 'NEW', ts: '12:14:00', part: 7, offset: 1284101, payload: '{"orderId":"ord_6r9t2y","customer":{"id":"u_u1i5o0"},"items":[…],"total":332}' },
];

const ScreenMessageList = () => (
  <div className="dls" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <TopBar />
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <Sidebar active="orders" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* breadcrumb header */}
        <div style={{ padding: '16px 22px 12px', borderBottom: '1px solid hsl(var(--border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'hsl(var(--muted-foreground))', marginBottom: 6 }}>
            <span className="mono">prod-us-east-1</span><I.chevron size={9} />
            <span className="mono">orders.dlq</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="t-h1 mono" style={{ fontSize: 20 }}>orders.dlq</span>
              <span className="badge" style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.3)', textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>
                12 NEW
              </span>
              <span className="t-small mono">8 partitions · replay → topic.orders</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" icon={<I.download size={12} />}>Export</Btn>
              <Btn variant="secondary" icon={<I.refresh size={12} />}>Fetch now</Btn>
              <Btn variant="primary" disabled={true} icon={<I.zap size={12} />}>Replay (1)</Btn>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Filter panel */}
          <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid hsl(var(--border))', padding: 14, overflow: 'auto' }} className="scroll">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span className="t-h4">Filters</span>
              <a className="t-tiny" style={{ color: 'hsl(var(--primary))', cursor: 'pointer' }}>Clear</a>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, marginBottom: 6, fontWeight: 500 }}>Status</div>
              {['NEW','UNDER_REVIEW','REPLAY_FAILED','REPLAYED','DISCARDED'].map((s, i) => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                  <Checkbox checked={i < 3} />
                  <StatusBadge status={s} />
                </label>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, marginBottom: 6, fontWeight: 500 }}>Time range</div>
              <div className="select" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Last 24 hours</span><I.chevronDown size={11} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, marginBottom: 6, fontWeight: 500 }}>Partition</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[0,1,2,3,4,5,6,7].map(p => (
                  <span key={p} className="mono" style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 4,
                    background: [3,7].includes(p) ? 'hsl(var(--primary) / 0.18)' : 'hsl(var(--muted))',
                    color: [3,7].includes(p) ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    border: [3,7].includes(p) ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid hsl(var(--border))',
                    cursor: 'pointer',
                  }}>{p}</span>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, marginBottom: 6, fontWeight: 500 }}>Offset range</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="input mono" placeholder="from" style={{ padding: '3px 6px', fontSize: 11 }} />
                <input className="input mono" placeholder="to" style={{ padding: '3px 6px', fontSize: 11 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, marginBottom: 6, fontWeight: 500 }}>Schema ID</div>
              <input className="input mono" placeholder="e.g. 1042" style={{ fontSize: 11 }} />
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflow: 'auto' }} className="scroll">
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ width: 28 }}><Checkbox /></th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 96 }}>Timestamp</th>
                    <th style={{ width: 56 }}>Part</th>
                    <th style={{ width: 110 }}>Offset</th>
                    <th>Payload preview</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_MSGS.map((m, i) => (
                    <tr key={i} className={m.sel ? 'selected' : undefined}>
                      <td><Checkbox checked={m.sel} /></td>
                      <td><StatusBadge status={m.st} /></td>
                      <td className="mono" style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11.5 }}>{m.ts}</td>
                      <td className="mono">{m.part}</td>
                      <td className="mono">{m.offset.toLocaleString()}</td>
                      <td><span className="mono" style={{ fontSize: 11.5, color: m.st === 'DISCARDED' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground) / 0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 540 }}>{m.payload}</span></td>
                      <td><button className="btn btn-ghost" style={{ width: 22, height: 22, padding: 0 }}><I.more size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* pagination footer */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid hsl(var(--border))', gap: 8, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
              <span>1 selected</span>
              <span>·</span>
              <span>Showing 10 of 428</span>
              <div style={{ flex: 1 }} />
              <Btn variant="ghost" size="sm">‹ Prev</Btn>
              <span className="mono">1 / 43</span>
              <Btn variant="ghost" size="sm">Next ›</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Checkbox = ({ checked }) => (
  <span style={{
    display: 'inline-block', width: 14, height: 14, borderRadius: 3,
    border: `1px solid ${checked ? 'hsl(var(--primary))' : 'hsl(var(--border-strong))'}`,
    background: checked ? 'hsl(var(--primary))' : 'hsl(var(--input))',
    position: 'relative', verticalAlign: 'middle',
  }}>
    {checked && <svg width="14" height="14" viewBox="0 0 14 14" style={{ position: 'absolute', inset: 0 }}>
      <path d="m3 7 3 3 5-5" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>}
  </span>
);

// ════════════════════════════════════════════════════════════
//  3. Message Detail
// ════════════════════════════════════════════════════════════
const ScreenMessageDetail = () => {
  const payload = {
    orderId: "ord_4p1x2n",
    customer: { id: "u_a3b9c2", tier: "silver", region: "us-east-1" },
    items: [
      { sku: "BR-117", qty: 2, price: 84 },
      { sku: "GL-202", qty: 1, price: 14 },
    ],
    total: 182,
    currency: "USD",
    placedAt: "2026-05-17T14:28:11Z",
    metadata: { source: "web", coupon: null },
  };
  return (
    <div className="dls" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar active="orders" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '14px 22px', borderBottom: '1px solid hsl(var(--border))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
              <span className="mono" style={{ cursor: 'pointer' }}>orders.dlq</span>
              <I.chevron size={9} />
              <span className="mono">part 7 · offset 1,284,872</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <StatusBadge status="UNDER_REVIEW" size="lg" />
              <span className="t-h1 mono" style={{ fontSize: 18 }}>ord_4p1x2n</span>
              <span style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn variant="ghost" icon={<I.copy size={12} />}>Copy ID</Btn>
                <div className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Status:</span>
                  <span style={{ fontWeight: 600 }}>UNDER_REVIEW</span>
                  <I.chevronDown size={11} />
                </div>
                <Btn variant="primary" icon={<I.zap size={12} />}>Replay</Btn>
              </div>
            </div>
          </div>

          {/* Body: split */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* Left: metadata + payload */}
            <div style={{ flex: 1.4, padding: 18, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }} className="scroll">
              {/* meta grid */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px 20px' }}>
                  <Meta label="Timestamp" value="2026-05-17 14:28:11.402 UTC" />
                  <Meta label="Partition" value="7" />
                  <Meta label="Offset" value="1,284,872" />
                  <Meta label="Producer" value="orders-svc@1.18.2" />
                  <Meta label="Key" value="ord_4p1x2n" />
                  <Meta label="Schema" value="OrderCreated v1.17 · id 1042" />
                  <Meta label="Replay topic" value="topic.orders" />
                  <Meta label="Failure reason" value="schema_violation" warn />
                </div>
              </div>

              {/* payload section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div className="t-h2">Payload</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span className="badge" style={{ background: 'hsl(var(--primary) / 0.16)', color: 'hsl(var(--primary))', textTransform: 'none', letterSpacing: 0, fontSize: 10.5, height: 20, padding: '0 8px' }}>JSON</span>
                    <span className="badge" style={{ background: 'transparent', color: 'hsl(var(--muted-foreground))', textTransform: 'none', letterSpacing: 0, fontSize: 10.5, height: 20, padding: '0 8px' }}>Raw bytes</span>
                  </div>
                </div>
                <JSONView data={payload} height={210} />
              </div>

              {/* Headers */}
              <div>
                <div className="t-h2" style={{ marginBottom: 8 }}>Kafka headers</div>
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table className="table">
                    <thead><tr><th style={{ width: '34%' }}>Key</th><th>Value</th></tr></thead>
                    <tbody>
                      <tr><td className="mono">content-type</td><td className="mono">application/avro</td></tr>
                      <tr><td className="mono">schema-id</td><td className="mono">1042</td></tr>
                      <tr><td className="mono">trace-id</td><td className="mono">2c1d7a4b9f8e3c5d6a8f7b2e1d0c9a8f7</td></tr>
                      <tr><td className="mono">producer</td><td className="mono">orders-svc@1.18.2 · pod orders-svc-7d4f</td></tr>
                      <tr><td className="mono">x-retry-count</td><td className="mono">3</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: notes panel */}
            <div style={{ flex: 1, borderLeft: '1px solid hsl(var(--border))', background: 'hsl(var(--card) / 0.3)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="t-h2">Notes</div>
                  <div className="t-small">3 notes · linked to INC-2891</div>
                </div>
                <button className="btn btn-ghost" style={{ width: 24, height: 24, padding: 0 }}><I.more size={13} /></button>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }} className="scroll">
                <NoteThread />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Meta = ({ label, value, warn }) => (
  <div>
    <div className="t-h4" style={{ fontSize: 10.5, marginBottom: 3 }}>{label}</div>
    <div className="mono" style={{ fontSize: 12, color: warn ? 'hsl(var(--warning))' : 'hsl(var(--foreground))' }}>{value}</div>
  </div>
);

// ════════════════════════════════════════════════════════════
//  4. Replay Wizard
// ════════════════════════════════════════════════════════════
const ReplayWizard = ({ step = 2 }) => (
  <div className="dls" style={{ height: '100%', background: 'hsl(var(--background))', display: 'flex', flexDirection: 'column' }}>
    {/* modal header */}
    <div style={{ padding: '14px 22px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', gap: 14 }}>
      <I.zap size={16} style={{ color: 'hsl(var(--primary))' }} />
      <div>
        <div className="t-h2" style={{ fontSize: 15 }}>Replay message</div>
        <div className="t-tiny mono">orders.dlq · part 7 · offset 1,284,872</div>
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn btn-ghost" style={{ width: 26, height: 26, padding: 0 }}><I.x size={13} /></button>
    </div>

    {/* stepper */}
    <div style={{ padding: '12px 22px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', gap: 6, alignItems: 'center' }}>
      <Step n={1} label="Review" state={step > 1 ? 'done' : (step === 1 ? 'active' : 'todo')} />
      <Line />
      <Step n={2} label="Edit Payload" state={step > 2 ? 'done' : (step === 2 ? 'active' : 'todo')} />
      <Line />
      <Step n={3} label="Confirm" state={step === 3 ? 'active' : 'todo'} />
    </div>

    {/* content — step 2 (edit payload, with validation error) */}
    <div style={{ flex: 1, padding: 22, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }} className="scroll">
      <div>
        <div className="t-h2" style={{ marginBottom: 4 }}>Edit payload</div>
        <div className="t-small">Optional. The producer's required field <span className="mono" style={{ color: 'hsl(var(--warning))' }}>customerId</span> is missing — add it before replay, or revert to original.</div>
      </div>

      {/* JSON editor */}
      <div style={{ background: 'hsl(var(--code-bg))', border: '1px solid hsl(var(--destructive) / 0.4)', borderRadius: 6, overflow: 'hidden', boxShadow: '0 0 0 3px hsl(var(--destructive) / 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid hsl(var(--border))', fontSize: 11 }}>
          <span className="mono" style={{ color: 'hsl(var(--muted-foreground))' }}>payload.json</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10.5, color: 'hsl(var(--destructive))' }}>
            <I.err size={11} /> 1 schema violation
          </div>
        </div>
        <pre className="mono scroll" style={{ margin: 0, padding: '10px 12px 14px', fontSize: 12, lineHeight: 1.55, color: 'hsl(var(--code-fg))', height: 220, overflow: 'auto' }}>
{`{
  `}<span style={{ color: 'hsl(var(--code-key))' }}>"orderId"</span>{`: `}<span style={{ color: 'hsl(var(--code-string))' }}>"ord_4p1x2n"</span>{`,
  `}<span style={{ color: 'hsl(var(--code-key))' }}>"customer"</span>{`: {
    `}<span style={{ color: 'hsl(var(--code-key))' }}>"id"</span>{`: `}<span style={{ color: 'hsl(var(--code-string))' }}>"u_a3b9c2"</span>{`,
    `}<span style={{ color: 'hsl(var(--code-key))' }}>"tier"</span>{`: `}<span style={{ color: 'hsl(var(--code-string))' }}>"silver"</span>{`
  },`}<span style={{ background: 'hsl(var(--destructive) / 0.22)', display: 'inline-block', width: '70%', borderLeft: '2px solid hsl(var(--destructive))', paddingLeft: 4, marginLeft: -4, color: 'hsl(var(--destructive))' }}>{`  ← missing required: customerId`}</span>{`
  `}<span style={{ color: 'hsl(var(--code-key))' }}>"items"</span>{`: [
    { `}<span style={{ color: 'hsl(var(--code-key))' }}>"sku"</span>{`: `}<span style={{ color: 'hsl(var(--code-string))' }}>"BR-117"</span>{`, `}<span style={{ color: 'hsl(var(--code-key))' }}>"qty"</span>{`: `}<span style={{ color: 'hsl(var(--code-number))' }}>2</span>{` },
    { `}<span style={{ color: 'hsl(var(--code-key))' }}>"sku"</span>{`: `}<span style={{ color: 'hsl(var(--code-string))' }}>"GL-202"</span>{`, `}<span style={{ color: 'hsl(var(--code-key))' }}>"qty"</span>{`: `}<span style={{ color: 'hsl(var(--code-number))' }}>1</span>{` }
  ],
  `}<span style={{ color: 'hsl(var(--code-key))' }}>"total"</span>{`: `}<span style={{ color: 'hsl(var(--code-number))' }}>182</span>{`,
  `}<span style={{ color: 'hsl(var(--code-key))' }}>"currency"</span>{`: `}<span style={{ color: 'hsl(var(--code-string))' }}>"USD"</span>{`
}`}
        </pre>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'hsl(var(--destructive) / 0.08)', borderRadius: 6, border: '1px solid hsl(var(--destructive) / 0.25)' }}>
        <I.err size={12} style={{ color: 'hsl(var(--destructive))', marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'hsl(var(--destructive))' }}>Schema violation · OrderCreated v1.18</div>
          <div style={{ fontSize: 11.5, color: 'hsl(var(--foreground) / 0.85)', marginTop: 2 }}>
            <span className="mono">/customerId</span> — required field. Suggested from prior record: <span className="mono" style={{ color: 'hsl(var(--warning))' }}>"u_a3b9c2"</span>
          </div>
        </div>
        <Btn variant="secondary" size="sm">Apply suggestion</Btn>
      </div>
      <div className="t-tiny" style={{ display: 'flex', gap: 14 }}>
        <span><Kbd>⌘</Kbd> + <Kbd>S</Kbd> Format</span>
        <span><Kbd>⌘</Kbd> + <Kbd>Z</Kbd> Revert to original</span>
        <span><Kbd>Esc</Kbd> Cancel</span>
      </div>
    </div>

    {/* footer */}
    <div style={{ padding: '12px 22px', borderTop: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', gap: 8, background: 'hsl(var(--card) / 0.5)' }}>
      <Btn variant="ghost">Cancel</Btn>
      <div style={{ flex: 1 }} />
      <Btn variant="secondary">‹ Back</Btn>
      <Btn variant="primary" disabled icon={<I.err size={12} />}>Confirm (1 violation)</Btn>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════
//  5. Cluster Configuration
// ════════════════════════════════════════════════════════════
const ScreenClusterConfig = () => (
  <div className="dls" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <TopBar />
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <SettingsNav active="clusters" />
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }} className="scroll">
        <div style={{ maxWidth: 720 }}>
          <div className="t-h4">Settings · Clusters</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <div className="t-h1">Edit cluster</div>
            <RoleBadge role="ADMIN" />
          </div>
          <div className="t-small" style={{ marginBottom: 22 }}>Connection details and credentials for <span className="mono">prod-us-east-1</span>.</div>

          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SettingsField label="Cluster name" hint="A short identifier shown across the app">
              <input className="input" defaultValue="prod-us-east-1" />
            </SettingsField>
            <SettingsField label="Bootstrap servers" hint="Comma-separated host:port pairs">
              <textarea className="textarea mono" rows="2" defaultValue="kafka-0.prod-us-east-1.example.com:9093,kafka-1.prod-us-east-1.example.com:9093,kafka-2.prod-us-east-1.example.com:9093" />
            </SettingsField>
            <SettingsField label="Security protocol">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {['PLAINTEXT','SSL','SASL_PLAIN','SASL_SSL'].map(p => (
                  <div key={p} style={{
                    padding: '8px 10px', borderRadius: 6, fontSize: 12, textAlign: 'center',
                    background: p === 'SASL_SSL' ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--input))',
                    border: p === 'SASL_SSL' ? '1px solid hsl(var(--primary) / 0.5)' : '1px solid hsl(var(--border))',
                    color: p === 'SASL_SSL' ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                    fontWeight: p === 'SASL_SSL' ? 600 : 400,
                    cursor: 'pointer',
                  }} className="mono">{p}</div>
                ))}
              </div>
            </SettingsField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <SettingsField label="SASL mechanism">
                <div className="select" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono">SCRAM-SHA-512</span><I.chevronDown size={11} />
                </div>
              </SettingsField>
              <SettingsField label="Username">
                <input className="input mono" defaultValue="dlq-svc-prod" />
              </SettingsField>
              <SettingsField label="Password" hint="Stored encrypted">
                <input className="input mono" type="password" defaultValue="••••••••••••••••" />
              </SettingsField>
              <SettingsField label="CA certificate" hint="Optional, PEM">
                <div className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span className="mono" style={{ fontSize: 11.5 }}>ca-prod.pem</span>
                  <I.download size={11} style={{ color: 'hsl(var(--muted-foreground))', transform: 'rotate(180deg)' }} />
                </div>
              </SettingsField>
            </div>

            <div className="divider" />

            <SettingsField label="Schema Registry URL" hint="Used to validate replayed payloads">
              <input className="input mono" defaultValue="https://schema-registry.prod-us-east-1.example.com" />
            </SettingsField>
            <SettingsField label="Schema Registry auth">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="input mono" placeholder="username" defaultValue="dlq-svc-readonly" />
                <input className="input mono" type="password" placeholder="password" defaultValue="••••••••" />
              </div>
            </SettingsField>
          </div>

          {/* Test connection result */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Btn variant="secondary" icon={<I.globe size={12} />}>Test connection</Btn>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'hsl(var(--success) / 0.1)', border: '1px solid hsl(var(--success) / 0.3)', borderRadius: 6, fontSize: 12 }}>
              <I.ok size={12} style={{ color: 'hsl(var(--success))' }} />
              <span style={{ color: 'hsl(var(--success))' }}>Connected.</span>
              <span className="mono" style={{ color: 'hsl(var(--muted-foreground))' }}>3 brokers · 142ms · schema-registry OK</span>
            </div>
          </div>

          <div style={{ marginTop: 22, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost">Cancel</Btn>
            <Btn variant="primary">Save changes</Btn>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SettingsField = ({ label, hint, children }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500 }}>{label}</label>
      {hint && <span className="t-tiny">{hint}</span>}
    </div>
    {children}
  </div>
);

const SettingsNav = ({ active }) => {
  const items = [
    ['clusters', 'Clusters', <I.database size={12} />],
    ['dlqs', 'DLQ configs', <I.layers size={12} />],
    ['replay', 'Replay policies', <I.zap size={12} />],
    ['members', 'Members', <I.user size={12} />],
    ['oidc', 'Authentication', <I.lock size={12} />],
    ['audit', 'Audit log', <I.command size={12} />],
  ];
  return (
    <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid hsl(var(--border))', background: 'hsl(var(--card) / 0.4)', padding: 14 }}>
      <div className="t-h4" style={{ marginBottom: 10, paddingLeft: 8 }}>Settings</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(([id, label, icon]) => (
          <SidebarItem key={id} icon={icon} label={label} active={id === active} />
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  6. First-Run Setup
// ════════════════════════════════════════════════════════════
const ScreenFirstRun = () => (
  <div className="dls" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
    {/* subtle bg */}
    <div className="dot-grid" style={{ position: 'absolute', inset: 0, opacity: 0.4 }} />
    <div style={{ position: 'absolute', top: 22, left: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
      <Logo size={18} />
      <span style={{ fontWeight: 600, fontSize: 13 }}>Dead Letter Society</span>
    </div>
    <div style={{ position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }} className="mono">
      v0.14.2 · self-hosted
    </div>

    <div style={{ width: 380, position: 'relative' }}>
      <div className="t-h4" style={{ textAlign: 'center', marginBottom: 6 }}>STEP 1 OF 1</div>
      <div className="t-h1" style={{ textAlign: 'center', fontSize: 22, marginBottom: 4 }}>Create administrator account</div>
      <div className="t-small" style={{ textAlign: 'center', marginBottom: 22 }}>This account will manage clusters and grant access to others.</div>

      <div className="card-elevated" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 24px 48px hsl(0 0% 0% / 0.5)' }}>
        <SettingsField label="Email">
          <input className="input" defaultValue="admin@acme.io" />
        </SettingsField>
        <SettingsField label="Display name">
          <input className="input" defaultValue="Jordan Kuo" />
        </SettingsField>
        <SettingsField label="Password" hint="At least 12 characters">
          <input className="input" type="password" defaultValue="••••••••••••••" />
          <div style={{ marginTop: 6, display: 'flex', gap: 3 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'hsl(var(--success))' }} />
            <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'hsl(var(--success))' }} />
            <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'hsl(var(--success))' }} />
            <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'hsl(var(--muted))' }} />
          </div>
          <div className="t-tiny" style={{ marginTop: 4, color: 'hsl(var(--success))' }}>Strong</div>
        </SettingsField>
        <Btn variant="primary" size="lg" style={{ width: '100%', marginTop: 4 }} icon={<I.arrowRight size={12} />}>Create admin account</Btn>
      </div>
      <div className="t-tiny" style={{ textAlign: 'center', marginTop: 14 }}>
        Once created, you'll connect your first Kafka cluster.
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════
//  7. Login Page
// ════════════════════════════════════════════════════════════
const ScreenLogin = ({ withError = false } = {}) => (
  <div className="dls" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
    <div className="dot-grid" style={{ position: 'absolute', inset: 0, opacity: 0.4 }} />
    <div style={{ position: 'absolute', top: 22, left: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
      <Logo size={18} />
      <span style={{ fontWeight: 600, fontSize: 13 }}>Dead Letter Society</span>
    </div>

    <div style={{ width: 340 }}>
      <div className="t-h1" style={{ textAlign: 'center', fontSize: 22, marginBottom: 4 }}>Sign in</div>
      <div className="t-small" style={{ textAlign: 'center', marginBottom: 22 }}>Access dead letter queues and replay messages.</div>

      <div className="card-elevated" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 24px 48px hsl(0 0% 0% / 0.5)' }}>
        <Btn variant="secondary" size="lg" icon={<I.lock size={12} />} style={{ width: '100%', justifyContent: 'center' }}>Continue with Okta SSO</Btn>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
          <div style={{ flex: 1, height: 1, background: 'hsl(var(--border))' }} />
          <span className="mono">OR</span>
          <div style={{ flex: 1, height: 1, background: 'hsl(var(--border))' }} />
        </div>
        {withError && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 10px', background: 'hsl(var(--destructive) / 0.08)', border: '1px solid hsl(var(--destructive) / 0.3)', borderRadius: 6, fontSize: 11.5 }}>
            <I.lock size={12} style={{ color: 'hsl(var(--destructive))', marginTop: 1 }} />
            <div>
              <div style={{ color: 'hsl(var(--destructive))', fontWeight: 500 }}>Account temporarily locked</div>
              <div style={{ color: 'hsl(var(--foreground) / 0.8)', marginTop: 2 }}>Too many failed attempts. Try again in 4 minutes or contact your admin.</div>
            </div>
          </div>
        )}
        <SettingsField label="Email">
          <input className="input" defaultValue={withError ? 'admin@acme.io' : ''} placeholder="you@company.com" />
        </SettingsField>
        <SettingsField label="Password">
          <input className={`input ${withError ? 'error' : ''}`} type="password" defaultValue={withError ? '•••••••••' : ''} placeholder="••••••••" />
        </SettingsField>
        <Btn variant="primary" size="lg" style={{ width: '100%', marginTop: 2 }} disabled={withError}>{withError ? 'Locked out' : 'Sign in'}</Btn>
      </div>
      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11.5 }}>
        <a style={{ color: 'hsl(var(--primary))', cursor: 'pointer' }}>Forgot password?</a>
        <span style={{ color: 'hsl(var(--muted-foreground))', margin: '0 8px' }}>·</span>
        <a style={{ color: 'hsl(var(--muted-foreground))', cursor: 'pointer' }}>Contact admin</a>
      </div>
    </div>
  </div>
);

Object.assign(window, {
  ScreenDashboard, ScreenMessageList, ScreenMessageDetail,
  ReplayWizard, ScreenClusterConfig, ScreenFirstRun, ScreenLogin,
  Sidebar,
});
