# OIC Localization, RTL and Accessibility

**DECIDED release requirement:** English and Arabic, each with correct LTR/RTL behavior. A changed page is incomplete until all four locale/direction combinations meet acceptance. Arabic must use reviewed native terminology; raw English fallback is allowed only for proper nouns, technical IDs or explicitly untranslated copy identified for completion.

**CURRENT:** `i18n.ts` has English/Arabic messages and Arabic literal mappings; `oic_locale` is persisted in a cookie, and client state sets document `lang` and `dir`; PageFrame receives direction. Custom CSS uses some logical properties and RTL selectors. Coverage is mixed: literal Arabic and fallback paths exist, so presence of a language toggle is not proof of complete localization. **PLANNED:** page inventory, reviewed glossary, string audit and consistent typed translation keys.

**CURRENT owners:** `apps/oic-console/app/i18n.ts` provides locale types, navigation labels, dictionaries and literal fallback; `app/console-app.tsx` loads/persists locale and sets document `lang/dir`; `app/styles.css` contains logical properties, responsive breakpoints and reduced-motion rules; `app/format.ts` owns date/scalar formatting; `app/components/oic-frames.tsx` receives frame direction. Feature files still contain inline literals, so future changes audit rendered pages rather than assume dictionary coverage.

## Direction and input rules

Mirror navigation, inline-start/end, drawer entry, directional breadcrumbs and charts whose axes represent direction. Keep numeric direction, dates, UUIDs, request IDs, code, endpoints, stack/error identifiers and technical values in explicit LTR isolates. Do not reverse chronological order or numeric scale for RTL. Localize units, pluralization, number/date formatting and screen-reader names; preserve exact machine value separately from formatted value.

Keyboard order follows reading order and visible focus in both directions. Use semantic headings, landmarks, table headers, labels, names and status announcements; focus must not be indicated only by color. Modal focus containment/restoration, escape behavior, zoom/reflow, contrast, reduced-motion behavior and target sizing are required. Graphs/instruments need textual summaries and keyboard-accessible data tables. **Acceptance:** EN/LTR desktop, AR/RTL desktop, EN/LTR narrow, AR/RTL narrow; keyboard/screen-reader spot checks on every modified surface.
