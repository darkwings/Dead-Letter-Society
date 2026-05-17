# Claude Design Prompt — Dead Letter Society Design System

Paste this prompt into Claude Design (or Figma AI plugin) to generate the design system.

---

## Prompt

Design a complete design system for **Dead Letter Society** — a professional web application for software engineers, SRE, and DevOps teams to monitor and manage Kafka Dead Letter Queues.

---

### Brand & Personality

**Name:** Dead Letter Society — inspired by "dead letter" (postal: undeliverable mail) and underground societies. The name carries a slightly gothic, serious, underground-club feel — but the product is a rigorous operational tool.

**Personality:** Dark, precise, technical. Think: terminal aesthetic meets modern SaaS. Professional, not playful. Dense information, readable at a glance. Operators trust this tool at 3am during an incident.

**Tone:** Confident, minimal, surgical. No decorative noise.

---

### Visual Direction

- **Preferred theme:** Dark mode primary, light mode supported. Dark mode is the default.
- **Aesthetic references:** Linear.app, Vercel dashboard, Grafana dark theme, Warp terminal. Dense data tables that are still readable. Status-driven color language.
- **Typography:**
  - UI text: modern geometric sans-serif (Inter or Geist)
  - Code / payload / JSON / offsets: monospace (JetBrains Mono or Geist Mono)
- **Color palette direction:**
  - Background: very dark (not pure black — slightly warm or cool dark gray)
  - Primary accent: a desaturated purple or deep indigo (fits the "society" name)
  - Surface levels: 3 levels of depth (background / card / elevated card)
  - Semantic colors for message statuses (see below)
  - Danger: muted red (not aggressive)
  - Success: muted green
  - Warning: amber

---

### Message Status Color Language

This is the most important color system. Every message has a status. Colors must be immediately distinguishable at a glance in a dense table.

| Status | Semantic color | Suggested |
|--------|---------------|-----------|
| `NEW` | Neutral / default | Cool gray badge |
| `UNDER_REVIEW` | Info / in-progress | Blue badge |
| `REPLAYED` | Success | Muted green badge |
| `DISCARDED` | Muted / dismissed | Dark gray, strikethrough-ish |
| `REPLAY_FAILED` | Error / danger | Muted red badge |

Badges should be small, pill-shaped, uppercase text, readable on both dark and light backgrounds.

---

### Key Screens to Design

Design at least these screens (desktop-first, responsive):

#### 1. Dashboard / Home
- Left sidebar: list of DLQ Configs with badge counts (new message counts)
- Main area: summary cards — total messages by status across all accessible DLQs
- Recent activity feed (fetch completions, replays, new messages)
- Top bar: app name, user avatar, notifications bell

#### 2. Message List
- Dense table: status badge | timestamp | partition | offset | payload preview (truncated) | actions
- Filter panel (collapsible): status multi-select, date range, partition, offset range
- Pagination
- "Fetch Now" button (top right), disabled state with "Fetch in progress" indicator
- Badge showing count of `NEW` messages

#### 3. Message Detail
- Split layout: left = message metadata + decoded payload JSON viewer + raw payload toggle + Kafka headers table
- Right panel: Note Thread (comments list + add note form with optional ticket reference field)
- Bottom action bar: "Change Status" dropdown + "Replay" button (hidden for VIEWER role)
- Status badge prominently displayed at top

#### 4. Replay Wizard
- Multi-step modal or full-page:
  - Step 1 "Review": message summary, resolved replay topic, override topic input
  - Step 2 "Edit Payload" (optional, OPERATOR only): JSON editor with schema validation feedback, "Confirm" button disabled while violations exist, violation message below editor
  - Step 3 "Confirm": final summary — what will be sent, to which topic, by whom
- Progress indicator (steps)
- Cancel always available

#### 5. Cluster Configuration (ADMIN)
- Form: cluster name, bootstrap servers, security protocol selector, credential fields (dynamic based on protocol), Schema Registry URL + optional auth
- "Test Connection" button with inline result (success / specific error)

#### 6. First-Run Setup
- Centered card, full-page, minimal chrome
- "Create Administrator Account" — email, display name, password
- App logo / name prominent

#### 7. Login Page
- Same centered card aesthetic as setup
- Email + password
- "Sign in with [IDP]" button (OIDC mode)
- Lockout error state

---

### Component Library (minimum)

Define tokens and examples for:

- **Typography scale**: display, h1-h4, body, small, code/mono
- **Color tokens**: background, surface, surface-elevated, border, text-primary, text-muted, text-code, accent-primary, status colors (see above), error, success, warning
- **Buttons**: primary, secondary, ghost, destructive — all with hover/active/disabled states
- **Badge / Chip**: status badges (all 5 message statuses), role badges (ADMIN, VIEWER, OPERATOR)
- **Input / Textarea / Select / DatePicker**: default, focus, error, disabled states
- **Table**: header, row, hover, selected row, empty state
- **Card**: default, clickable, elevated
- **Sidebar**: collapsible, active item, badge counter on item
- **Toast notifications**: success, error, warning, info — positioned top-right
- **Modal / Dialog**: with header, content, footer actions
- **Wizard**: step indicator, step content area, navigation buttons
- **JSON Viewer**: syntax-highlighted JSON with expand/collapse, copy button, line numbers
- **Kafka Headers Table**: compact two-column table (key / value), monospace values
- **Note Thread**: comment bubble (author, timestamp, content, ticket reference tag), add note form
- **Fetch Status Indicator**: animated spinner + "Fetch in progress" text, disabled button state
- **Empty State**: icon + title + description, optional CTA button

---

### Technical Constraints

The design system MUST be compatible with:

- **shadcn/ui** component library (components use Radix UI primitives + Tailwind CSS)
- **Tailwind CSS v4** with CSS custom properties for theming
- **Output format needed**: CSS variable definitions (`--background`, `--foreground`, `--primary`, `--card`, etc.) following shadcn/ui's variable naming convention, plus Tailwind config overrides

The CSS variables should cover both dark and light theme. Dark is `:root`, light is `.light` class override (or vice versa — follow shadcn/ui convention).

Example output format expected:
```css
:root {
  --background: 224 15% 8%;
  --foreground: 220 10% 92%;
  --card: 224 12% 11%;
  --card-foreground: 220 10% 92%;
  --primary: 258 60% 65%;
  --primary-foreground: 258 100% 98%;
  --muted: 220 8% 20%;
  --muted-foreground: 220 8% 55%;
  /* ... */
  --status-new: 220 12% 45%;
  --status-under-review: 211 80% 55%;
  --status-replayed: 142 60% 45%;
  --status-discarded: 220 8% 35%;
  --status-replay-failed: 0 65% 50%;
}
```

---

### Deliverables

1. **Color system** — full token set in CSS variable format (dark + light)
2. **Typography system** — scale + font stack
3. **Component designs** — all components listed above, in dark theme, annotated
4. **Key screen mockups** — all 7 screens listed above
5. **Tailwind config snippet** — to register the custom tokens

---

### Constraints

- No gradients on interactive elements
- No pure black (#000) or pure white (#fff) — use near-black/near-white
- Sufficient contrast ratios (WCAG AA minimum for text)
- Dense data layouts — avoid excessive whitespace, this is a tool not a marketing page
- Monospace font mandatory for: offsets, payload content, Kafka headers values, schema IDs
