# OIC Visual Design System

**DECIDED identity:** deep neutral black and near-black surfaces, white/neutral typography, restrained amber/yellow intelligence identity, and precision neon only for meaningful active data. Green is semantic success/health only; orange is warning/degraded; red is critical/destructive; neutral gray is inactive/offline. Amber marks OIC identity, selection, focus context and intelligence emphasis, never success.

## Tokens and hierarchy

| Role | Contract |
|---|---|
| Canvas / surface | Black canvas; stepped near-black panel and elevated overlay surfaces; avoid a green-tinted cast. |
| Text | High-contrast primary; secondary for explanation; tertiary for technical labels; disabled remains legible. |
| Borders | Quiet structural dividers; stronger on selected/focused/critical surfaces. |
| Semantic | Green success/healthy; orange warning/degraded; red critical/destructive; neutral unavailable/offline. |
| Amber | OIC brand, active navigation, focus accents, intelligence emphasis. |
| Glow | None by default; small local halo for live/focus; strong glow reserved for rare explicit emphasis. |

**CURRENT:** custom global CSS and CSS variables exist; X1-1 adds OIC frame/primitives and token/component rules. It is not a standalone design-system package. **DECIDED:** typography roles are product/heading, body/operator labels, and monospace IDs/micro-labels; use technical labels sparingly and always explain unfamiliar status. Compact density must preserve hierarchy and touch/keyboard target sizing. Prefer square/low-radius technical panels; larger radius only for overlays or controls where it aids affordance.

## Interaction states and accessibility

Hover communicates affordance, not state. Focus is keyboard-visible and high contrast. Selected uses border/shape plus amber; live includes text/state and restrained semantic green; offline/unavailable never glows green. Disabled controls explain why. Motion is short, purposeful and nonessential; respect `prefers-reduced-motion` (CURRENT global CSS does). Preserve contrast, zoom, semantic headings/landmarks, labels, focus trapping/restoration in modal surfaces, and status announcements.

**Prohibited:** mint/green decorative cast, cheap cyberpunk, rainbow neon, large bloom, gaming UI, generic SaaS templates, color-only state communication, and flashing live effects. Use the supplied visual reference for craftsmanship, darkness, density and precision only. Flight Deck content belongs to X1-2.

## Token contract

**CURRENT seed values** are the CSS custom properties in `apps/oic-console/app/styles.css`; retain semantics while migrating toward the following named token families. Values below are a starting contract, not permission to recolor every legacy selector independently.

| Family | Token examples / current seed | Use |
|---|---|---|
| SURFACES | `--oic-surface-canvas #080909`, `--oic-surface-1 #0c0d0d`, `--oic-surface-2 #101111`, `--oic-surface-raised #151616` | Canvas → panel → focused overlay. Keep neutral, not green tinted. |
| TEXT | `--oic-text-primary #f0f0ec`, `--oic-text-secondary #b1b1aa`, `--oic-text-muted #777872`, `--oic-text-disabled` | Maintain contrast; disabled token must still meet readable contrast for required metadata. |
| BORDERS | `--oic-border #242525`, `--oic-border-strong #363737`, `--oic-border-focus` | Structure, elevation and focus; do not substitute glow for border. |
| INTELLIGENCE AMBER | `--oic-amber #e7c25f`, `--oic-amber-dim #b6984d` | Identity, selection and focused intelligence context. |
| SUCCESS GREEN | `--oic-success #aee18a` | Confirmed healthy/success only. Never brand or idle. |
| WARNING ORANGE | `--oic-warning #f1ad62` | Warning/degraded with text/icon. |
| CRITICAL RED | `--oic-critical #ff927d` | Critical/destructive/fault with text/icon. |
| INACTIVE / OFFLINE | `--oic-neutral-state #777872` | Inactive/unknown/offline; never red unless actual fault. |
| SHADOW | `--oic-shadow-overlay 0 26px 76px rgba(0,0,0,.46)` | Dialog/drawer elevation only; avoid shadows on every card. |
| GLOW | `--oic-glow-subtle 0 0 14px rgba(231,194,95,.13)` | Only state-appropriate precision accents below. |
| FOCUS | `--oic-focus-ring 2px solid var(--oic-amber)`; 3px offset | Keyboard-visible focus; never remove without equivalent. |
| MOTION | fast 140ms, standard 200ms seed | State transition; no continuous motion except genuine live indication and reduced-motion alternative. |
| SPACING | 4, 8, 12, 16, 24px seed; extend 32/40/48 | Consistent density rhythm; tables may use compact aliases. |
| RADIUS | 2px and 4px seed | Technical panels/controls; avoid pill-everything. |
| Z-LAYERS | base 0; sticky local 10; sidebar 20; topbar 30; popover 50; drawer scrim 80; drawer 90; dialog scrim 100; dialog 110; toast 120 | One documented stacking scale; nested contexts must not escape modality. |

Color values are seed tokens, not automatic contrast certification. Acceptance tests contrast for actual text/background pairs; amber text on dark and green-on-dark require measured contrast. Semantic status always includes text or icon and accessible name.

## Hierarchy, glow and density

Visual nesting is `Page → Workspace → Panel → Instrument deck (future) → Card → Inspector / Drawer / Dialog / Popover`. Page has one H1; workspace group has H2; cards use H3; table/instrument caption labels are not fake headings. Tables separate row hover from row selection. Metric value is most prominent, unit/label second, state/source/freshness third, technical metadata last.

| Precision-neon level | Allowed surfaces |
|---|---|
| NONE | Default content, borders, inactive/offline, tables, text. |
| SUBTLE | Brand mark/orbit, live source hint, selected-panel edge; low-opacity local amber only. |
| ACTIVE | Focus ring and currently selected/active control; clear 1–2px accent, optional tiny local halo. |
| EMPHASIS | Rare incident/hero/one primary live signal. One element/group at a time; no full-page bloom or persistent pulsing. |

State light behavior: LIVE has explicit “Live” plus source timestamp and semantic light; SELECTED uses amber border/background tint (not green); FOCUSED uses ring and no layout shift; WARNING uses orange + wording; FAULT uses red + actionable cause; OFFLINE uses neutral + “Offline/Unavailable”.

Density modes: **standard** is default operator reading, with comfortable body copy and controls; **compact/instrument** is for high-volume Fleet/deck cells after legibility and targets are verified; **inspection/detail** increases spacing and wraps IDs/metadata for safe reading. Density changes layout only; never remove labels, units, state, keyboard target or source freshness.

Icon philosophy: use one consistent line weight and simple geometry; icons communicate actions or entity classes, not decoration. Pair unfamiliar/ambiguous marks with a visible or accessible label. Directional icons mirror; brand glyph, status glyph and technical symbol do not mirror unless their semantics require it. **CURRENT:** there is no declared icon library in `apps/oic-console/package.json`; current UI uses CSS/text glyphs and local components. An icon package decision belongs to X1-1 only if demonstrated coverage gaps block operation.
