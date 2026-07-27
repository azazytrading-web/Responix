# Platform Contracts Foundation

Sprint 06 Phase 1 introduces a renderer-neutral metadata vocabulary in
`@responix/types`. It is a transport contract only. It neither renders a UI
nor executes actions, queries, plugins, or authorization decisions.

## Root Manifest

`PlatformManifestDto` is versioned with `schemaVersion: "1.0"` and contains:

- `dashboard`: pages, sections, layouts, widgets, tables, forms, filters, and actions.
- `navigation`: sidebar, topbar, and breadcrumb metadata with nested items.
- `themes` and `whiteLabel`: brand, assets, design tokens, domains, emails, reports, modules, and dashboard references.
- `features` and `plugins`: dependency, capability, permission, plan, visibility, lifecycle, and category metadata.
- `openApi`: operation metadata reserved for later API publication.

All references are identifiers and JSON-compatible metadata. The contracts do
not contain HTML, CSS, React components, provider payloads, secrets, or tenant
authority.

## Access Metadata

Any page, section, widget, field, action, filter, navigation item, feature, or
plugin may include `PlatformVisibilityDto`. It describes permissions, roles,
plans, workspaces, feature flags, and a data condition for a future consumer.
It is not authorization: the existing backend guards remain authoritative.

## Extension Points

`PlatformExtensionRegistry` registers independently shipped `widget` and
`field` kinds. Registration rejects duplicates and extensions incompatible with
the current schema version. Manifest validation rejects unregistered custom
kinds and duplicate local identifiers.

Built-in widgets are card, metric, table, chart, list, tabs, timeline,
activity, markdown, JSON viewer, code viewer, button group, and quick actions.
Built-in fields include standard input types plus dynamic select,
autocomplete, secret, password, JSON, file, readonly, and hidden fields.

## Serialization

`serializePlatformManifest()` produces a detached JSON-compatible contract DTO.
Consumers may transport the result without retaining mutable references to the
source manifest. No HTTP endpoint is introduced in this phase.
