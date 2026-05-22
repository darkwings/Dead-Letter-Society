/* global React, StatusBadge, RoleBadge, Btn, I, Avatar, SidebarItem, JSONView, Toast, Kbd, TopBar, Logo */

// ─────────── Color swatch ───────────
const Sw = ({ name, token, value, sub }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
    <div style={{ width: 28, height: 28, borderRadius: 4, background: value, border: '1px solid hsl(var(--border-strong))' }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 500 }}>{name}</div>
      <div className="mono" style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{token}{sub ? ` · ${sub}` : ''}</div>
    </div>
  </div>
);

const TokenSurfaces = () => (
  <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    <Sw name="Background" token="--background" value="hsl(226 16% 7%)" sub="226 16 7" />
    <Sw name="Foreground" token="--foreground" value="hsl(220 14% 92%)" sub="220 14 92" />
    <Sw name="Card" token="--card" value="hsl(225 14% 10%)" sub="225 14 10" />
    <Sw name="Elevated" token="--elevated" value="hsl(224 13% 13%)" sub="224 13 13" />
    <Sw name="Muted" token="--muted" value="hsl(222 10% 16%)" sub="222 10 16" />
    <Sw name="Muted FG" token="--muted-foreground" value="hsl(220 8% 58%)" sub="220 8 58" />
    <Sw name="Border" token="--border" value="hsl(224 10% 18%)" sub="224 10 18" />
    <Sw name="Border strong" token="--border-strong" value="hsl(224 12% 24%)" sub="224 12 24" />
    <Sw name="Primary" token="--primary" value="hsl(258 52% 64%)" sub="258 52 64" />
    <Sw name="Ring" token="--ring" value="hsl(258 55% 60%)" sub="258 55 60" />
    <Sw name="Destructive" token="--destructive" value="hsl(358 60% 56%)" sub="358 60 56" />
    <Sw name="Success" token="--success" value="hsl(148 45% 48%)" sub="148 45 48" />
    <Sw name="Warning" token="--warning" value="hsl(36 75% 56%)" sub="36 75 56" />
    <Sw name="Info" token="--info" value="hsl(211 70% 58%)" sub="211 70 58" />
  </div>
);

const TokenStatuses = () => (
  <div style={{ padding: 20 }}>
    <div className="t-h4" style={{ marginBottom: 14 }}>Message status badges</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
      {['NEW','UNDER_REVIEW','REPLAYED','DISCARDED','REPLAY_FAILED'].map(s => (
        <StatusBadge key={s} status={s} />
      ))}
    </div>
    <div className="t-h4" style={{ marginBottom: 14 }}>Large variant</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
      {['NEW','UNDER_REVIEW','REPLAYED','DISCARDED','REPLAY_FAILED'].map(s => (
        <StatusBadge key={s} status={s} size="lg" />
      ))}
    </div>
    <div className="t-h4" style={{ marginBottom: 14 }}>Role badges</div>
    <div style={{ display: 'flex', gap: 8 }}>
      <RoleBadge role="ADMIN" /><RoleBadge role="OPERATOR" /><RoleBadge role="VIEWER" />
    </div>
    <div className="divider" style={{ margin: '22px 0' }} />
    <div className="t-h4" style={{ marginBottom: 12 }}>Status fill colors</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <Sw name="status-new" token="--status-new" value="hsl(220 10% 52%)" />
      <Sw name="under-review" token="--status-under-review" value="hsl(211 72% 58%)" />
      <Sw name="replayed" token="--status-replayed" value="hsl(148 50% 50%)" />
      <Sw name="discarded" token="--status-discarded" value="hsl(220 6% 38%)" />
      <Sw name="replay-failed" token="--status-replay-failed" value="hsl(358 62% 58%)" />
    </div>
  </div>
);

const TokenType = () => (
  <div style={{ padding: 22 }}>
    <div className="t-display">Dead Letter Society</div>
    <div className="t-small mono" style={{ marginTop: 2, marginBottom: 18 }}>Display · Geist 32/600 · -0.025em</div>

    <div className="t-h1">Replay 312 messages</div>
    <div className="t-small mono">H1 · Geist 22/600</div>
    <div className="divider" style={{ margin: '14px 0' }} />

    <div className="t-h2">Recent activity</div>
    <div className="t-small mono">H2 · Geist 17/600</div>
    <div className="divider" style={{ margin: '14px 0' }} />

    <div className="t-h3">Headers</div>
    <div className="t-small mono">H3 · Geist 14/600</div>
    <div className="divider" style={{ margin: '14px 0' }} />

    <div className="t-h4">Section label</div>
    <div className="t-small mono">H4 · Geist 12/600 caps · letter-spacing 0.04em</div>
    <div className="divider" style={{ margin: '14px 0' }} />

    <div className="t-body">Body — Operators trust this tool at 3am during an incident.</div>
    <div className="t-small mono">Body · Geist 13/400</div>
    <div className="divider" style={{ margin: '14px 0' }} />

    <div className="t-code">payload.userId === "u_q8k2j7"</div>
    <div className="t-small mono">Code · Geist Mono 12/400</div>
  </div>
);

// ─────────── Buttons gallery ───────────
const ButtonsGallery = () => (
  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
    <Row label="Primary">
      <Btn variant="primary" icon={<I.zap size={13} />}>Replay message</Btn>
      <Btn variant="primary" size="sm">Save</Btn>
      <Btn variant="primary" size="lg">Continue</Btn>
      <Btn variant="primary" disabled>Disabled</Btn>
    </Row>
    <Row label="Secondary">
      <Btn variant="secondary" icon={<I.refresh size={12} />}>Refresh</Btn>
      <Btn variant="secondary" size="sm">Cancel</Btn>
      <Btn variant="secondary" disabled>Disabled</Btn>
    </Row>
    <Row label="Ghost">
      <Btn variant="ghost" icon={<I.filter size={12} />}>Filters</Btn>
      <Btn variant="ghost" size="sm">Dismiss</Btn>
    </Row>
    <Row label="Destructive">
      <Btn variant="destructive" icon={<I.trash size={12} />}>Discard</Btn>
      <Btn variant="destructive" size="sm">Delete</Btn>
    </Row>
    <Row label="Icon only">
      <button className="btn btn-secondary" style={{ width: 28, padding: 0 }}><I.refresh size={13} /></button>
      <button className="btn btn-ghost" style={{ width: 28, padding: 0 }}><I.more size={13} /></button>
      <button className="btn btn-secondary" style={{ width: 28, padding: 0 }}><I.copy size={13} /></button>
    </Row>
  </div>
);
const Row = ({ label, children }) => (
  <div>
    <div className="t-h4" style={{ marginBottom: 8 }}>{label}</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
  </div>
);

// ─────────── Inputs ───────────
const InputsGallery = () => {
  const [val, setVal] = React.useState('topic.orders.dlq');
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Topic name">
        <input className="input" value={val} onChange={e => setVal(e.target.value)} />
      </Field>
      <Field label="Bootstrap servers" hint="Comma-separated host:port pairs">
        <input className="input mono" defaultValue="kafka-0.prod:9092,kafka-1.prod:9092" />
      </Field>
      <Field label="Security protocol">
        <div className="select" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <span>SASL_SSL</span>
          <I.chevronDown size={12} />
        </div>
      </Field>
      <Field label="Password" error="Connection failed: invalid credentials">
        <input className="input error" type="password" defaultValue="••••••••••••" />
      </Field>
      <Field label="Disabled">
        <input className="input" disabled defaultValue="—" />
      </Field>
      <Field label="Note">
        <textarea className="textarea" rows="3" defaultValue="Schema violation: missing required field `customerId`. Linked to incident INC-2891."></textarea>
      </Field>
      <Field label="Date range">
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="input mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span>2026-05-15 14:00</span><I.chevronDown size={11} />
          </div>
          <div style={{ alignSelf: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>→</div>
          <div className="input mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span>2026-05-17 14:00</span><I.chevronDown size={11} />
          </div>
        </div>
      </Field>
    </div>
  );
};
const Field = ({ label, hint, error, children }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <label style={{ fontSize: 11.5, fontWeight: 500, color: 'hsl(var(--foreground))' }}>{label}</label>
      {hint && !error && <span className="t-tiny mono">{hint}</span>}
    </div>
    {children}
    {error && <div style={{ marginTop: 5, fontSize: 11, color: 'hsl(var(--destructive))', display: 'flex', alignItems: 'center', gap: 4 }}>
      <I.err size={11} />{error}
    </div>}
  </div>
);

// ─────────── Tables ───────────
const TableGallery = () => (
  <div style={{ padding: 20 }}>
    <div className="card" style={{ overflow: 'hidden' }}>
      <table className="table">
        <thead><tr>
          <th style={{ width: 90 }}>Status</th>
          <th>Topic</th>
          <th style={{ width: 70 }}>Part</th>
          <th style={{ width: 110 }}>Offset</th>
          <th style={{ width: 90 }}>Age</th>
        </tr></thead>
        <tbody>
          <tr><td><StatusBadge status="NEW" /></td><td className="mono">orders.created</td><td className="mono">3</td><td className="mono">1,284,991</td><td className="mono">2m</td></tr>
          <tr className="selected"><td><StatusBadge status="UNDER_REVIEW" /></td><td className="mono">orders.created</td><td className="mono">7</td><td className="mono">1,284,872</td><td className="mono">14m</td></tr>
          <tr><td><StatusBadge status="REPLAYED" /></td><td className="mono">payments.captured</td><td className="mono">1</td><td className="mono">992,108</td><td className="mono">1h</td></tr>
          <tr><td><StatusBadge status="REPLAY_FAILED" /></td><td className="mono">orders.created</td><td className="mono">7</td><td className="mono">1,284,604</td><td className="mono">3h</td></tr>
          <tr><td><StatusBadge status="DISCARDED" /></td><td className="mono">notify.email</td><td className="mono">0</td><td className="mono">44,201</td><td className="mono">2d</td></tr>
        </tbody>
      </table>
    </div>
    <div className="t-tiny" style={{ marginTop: 8 }}>Hover, selected row (highlighted), and 5 status colors visible in dense rhythm.</div>
  </div>
);

// ─────────── JSON + headers ───────────
const JSONAndHeaders = () => (
  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <div className="t-h4" style={{ marginBottom: 8 }}>JSON viewer</div>
      <JSONView data={{
        orderId: 'ord_9k2j4m',
        customer: { id: 'u_q8k2j7', tier: 'gold' },
        items: [{ sku: 'BR-117', qty: 2 }],
        total: 4218,
        status: null,
        valid: false,
      }} height={210} />
    </div>
    <div>
      <div className="t-h4" style={{ marginBottom: 8 }}>Kafka headers</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table" style={{ fontSize: 11.5 }}>
          <thead><tr><th style={{ width: '40%' }}>Key</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td className="mono">content-type</td><td className="mono">application/avro</td></tr>
            <tr><td className="mono">schema-id</td><td className="mono">1042</td></tr>
            <tr><td className="mono">trace-id</td><td className="mono">2c1d…a8f7</td></tr>
            <tr><td className="mono">producer</td><td className="mono">orders-svc@1.18.2</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ─────────── Note thread ───────────
const NoteThread = () => (
  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <Note initials="MR" hue={36} name="m.rivera" when="3h ago" body="Schema mismatch — producer rolled out v1.18.2 with new required `customerId`. Filed INC-2891." ticket="INC-2891" />
    <Note initials="JK" hue={258} name="j.kuo" when="2h ago" body="Confirmed. Will re-emit after fixing the producer rollback. Holding under review." />
    <Note initials="DM" hue={148} name="d.mendez" when="22m ago" body="Producer reverted. Safe to replay this batch." />
    <div className="card-elevated" style={{ padding: 10 }}>
      <textarea className="textarea" placeholder="Add a note… (markdown supported)" rows="2" style={{ background: 'transparent', border: 'none', padding: 0 }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
          <I.ticket size={11} /> Link ticket
        </div>
        <input className="input mono" style={{ width: 110, height: 22, fontSize: 11 }} placeholder="INC-…" />
        <div style={{ flex: 1 }} />
        <Btn variant="primary" size="sm">Post note</Btn>
      </div>
    </div>
  </div>
);
const Note = ({ initials, hue, name, when, body, ticket }) => (
  <div style={{ display: 'flex', gap: 8 }}>
    <Avatar initials={initials} hue={hue} size={22} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
        <span className="t-tiny mono">{when}</span>
        {ticket && <span className="badge" style={{ background: 'hsl(var(--info) / 0.12)', color: 'hsl(var(--info))', border: '1px solid hsl(var(--info) / 0.3)', textTransform: 'none', letterSpacing: 0, fontSize: 9.5, height: 16 }}>
          <I.ticket size={9} />{ticket}
        </span>}
      </div>
      <div style={{ fontSize: 12.5, marginTop: 3, color: 'hsl(var(--foreground) / 0.92)' }}>{body}</div>
    </div>
  </div>
);

// ─────────── Toasts ───────────
const ToastStack = () => (
  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
    <Toast kind="success" title="Replayed to topic.orders" body="3 messages re-emitted at offset 1,285,002" />
    <Toast kind="error" title="Replay failed" body="Schema registry returned 422 — schema 1042 incompatible" />
    <Toast kind="warning" title="Fetch already in progress" body="Started 14s ago by m.rivera" />
    <Toast kind="info" title="New connection" body="Cluster eu-west-1 added by admin" />
  </div>
);

// ─────────── Empty state ───────────
const EmptyStateDemo = () => (
  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', gap: 8 }} className="scanlines">
    <div style={{ width: 48, height: 48, borderRadius: 999, background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', display: 'grid', placeItems: 'center', color: 'hsl(var(--muted-foreground))' }}>
      <I.inbox size={20} />
    </div>
    <div className="t-h2" style={{ marginTop: 6 }}>No dead letters</div>
    <div className="t-small" style={{ maxWidth: 280 }}>The queue is empty. Either everything is healthy, or no one has fetched yet.</div>
    <Btn variant="secondary" icon={<I.refresh size={12} />} style={{ marginTop: 8 }}>Fetch now</Btn>
  </div>
);

// ─────────── Wizard stepper (standalone display) ───────────
const StepperDemo = () => (
  <div style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 6 }}>
    <Step n={1} label="Review" state="done" />
    <Line />
    <Step n={2} label="Edit Payload" state="active" />
    <Line />
    <Step n={3} label="Confirm" state="todo" />
  </div>
);
const Step = ({ n, label, state }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <div style={{
      width: 22, height: 22, borderRadius: 999,
      display: 'grid', placeItems: 'center',
      fontSize: 11, fontWeight: 600,
      background: state === 'done' ? 'hsl(var(--primary))' : (state === 'active' ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))'),
      color: state === 'done' ? 'hsl(var(--primary-foreground))' : (state === 'active' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'),
      border: state === 'active' ? '1.5px solid hsl(var(--primary))' : '1px solid transparent',
    }}>{state === 'done' ? <I.check size={11} /> : n}</div>
    <span style={{ fontSize: 12, color: state === 'todo' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))', fontWeight: state === 'active' ? 600 : 500 }}>{label}</span>
  </div>
);
const Line = () => <div style={{ flex: 1, height: 1, background: 'hsl(var(--border))', minWidth: 16 }} />;

// ─────────── Fetch indicator ───────────
const FetchIndicator = () => (
  <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
    <Btn variant="primary" icon={<I.refresh size={12} />}>Fetch now</Btn>
    <Btn variant="primary" disabled icon={<I.spinner size={12} />}>Fetch in progress…</Btn>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'hsl(var(--info) / 0.08)', border: '1px solid hsl(var(--info) / 0.25)', borderRadius: 6, fontSize: 12, color: 'hsl(var(--info))' }}>
      <I.spinner size={12} /> Fetching from <span className="mono">orders.dlq</span> · 144 / ~400
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'hsl(var(--success))', animation: 'dls-pulse 1.4s ease-in-out infinite' }} />
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Cluster online</span>
      </span>
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>·</span>
      <span style={{ color: 'hsl(var(--muted-foreground))' }} className="mono">lag: 0</span>
    </div>
  </div>
);

// ─────────── Modal preview ───────────
const ModalDemo = () => (
  <div style={{ padding: 18, height: '100%', position: 'relative', background: 'hsl(var(--background) / 0.6)' }}>
    {/* mock backdrop content */}
    <div style={{ position: 'absolute', inset: 0, background: 'hsl(var(--background))', opacity: 0.4 }} className="dot-grid" />
    <div className="card-elevated" style={{
      position: 'relative', margin: '20px auto', width: 320,
      boxShadow: '0 24px 48px hsl(0 0% 0% / 0.6), 0 0 0 1px hsl(0 0% 0% / 0.4)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Discard 3 messages?</div>
          <div className="t-tiny">This cannot be undone.</div>
        </div>
        <button className="btn btn-ghost" style={{ width: 22, height: 22, padding: 0 }}><I.x size={12} /></button>
      </div>
      <div style={{ padding: 14, fontSize: 12.5, color: 'hsl(var(--foreground) / 0.9)' }}>
        Selected messages will be marked <StatusBadge status="DISCARDED" /> and excluded from future replays.
      </div>
      <div style={{ padding: 12, borderTop: '1px solid hsl(var(--border))', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost">Cancel</Btn>
        <Btn variant="destructive">Discard messages</Btn>
      </div>
    </div>
  </div>
);

// ─────────── Card variants ───────────
const CardGallery = () => (
  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div className="card" style={{ padding: 14 }}>
      <div className="t-h4">Default card</div>
      <div className="t-body" style={{ marginTop: 4 }}>Surface for grouping content. 1px border, no shadow.</div>
    </div>
    <div className="card" style={{ padding: 14, cursor: 'pointer', transition: 'border-color 120ms', borderColor: 'hsl(var(--border-strong))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div className="t-h4">Clickable card</div>
          <div className="t-body" style={{ marginTop: 4 }}>Hover: border lightens. Use for nav cards.</div>
        </div>
        <I.chevron size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
      </div>
    </div>
    <div className="card-elevated" style={{ padding: 14, boxShadow: '0 6px 24px hsl(0 0% 0% / 0.4)' }}>
      <div className="t-h4">Elevated</div>
      <div className="t-body" style={{ marginTop: 4 }}>Used for modals, dropdowns, popovers.</div>
    </div>
  </div>
);

// ─────────── Spacing scale ───────────
const SpacingScale = () => {
  const steps = [
    ['1', 4], ['2', 6], ['3', 8], ['4', 10], ['5', 12], ['6', 14], ['7', 18], ['8', 22], ['9', 28], ['10', 36], ['11', 48], ['12', 64],
  ];
  return (
    <div style={{ padding: 22 }}>
      <div className="t-h4" style={{ marginBottom: 12 }}>Spacing scale</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 11, width: 24, color: 'hsl(var(--muted-foreground))' }}>{k}</span>
            <span className="mono" style={{ fontSize: 11, width: 30 }}>{v}px</span>
            <div style={{ height: 10, width: v * 3, background: 'hsl(var(--primary) / 0.4)', borderLeft: '1px solid hsl(var(--primary))' }} />
          </div>
        ))}
      </div>
      <div className="divider" style={{ margin: '20px 0' }} />
      <div className="t-h4" style={{ marginBottom: 12 }}>Radius</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[2, 4, 6, 10, 999].map(r => (
          <div key={r} style={{ width: 44, height: 44, background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border-strong))', borderRadius: r, display: 'grid', placeItems: 'center', fontSize: 10 }} className="mono">{r === 999 ? '∞' : r}</div>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, {
  TokenSurfaces, TokenStatuses, TokenType,
  ButtonsGallery, InputsGallery, TableGallery,
  JSONAndHeaders, NoteThread, Note, ToastStack, EmptyStateDemo,
  StepperDemo, FetchIndicator, ModalDemo, CardGallery, SpacingScale,
  Field, Row, Sw, Step, Line,
});
