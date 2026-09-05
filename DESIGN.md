# Davao Light Outages — Design System

Information-first civic UI. Match this file before adding colors, type, spacing, or components.

## Principles

- Mobile-first, single-page map + list.
- Status meaning is consistent everywhere (badge, tab, marker).
- Color is never the only signal — pair with a label.
- No decorative gradients, no extra animation, no oversized cards.

## Type

| Token | Use |
| --- | --- |
| `--font-sans` (Geist) | UI and body |
| `--font-mono` (Geist Mono) | Source URLs, raw fragments, codes |

| Style | Size | Weight | Tracking |
| --- | --- | --- | --- |
| Display | `text-lg` / `text-xl` | 600 | tight |
| Title | `text-sm` / `text-base` | 600 | normal |
| Body | `text-sm` | 400 | normal |
| Meta | `text-xs` | 500 | wide on labels |

## Spacing

Use the Tailwind scale. Page padding: `px-4` (mobile), `px-6` (desktop). Stack gaps: `gap-2` / `gap-3` / `gap-4`. Panel max width: `28rem` on desktop list.

## Radius and borders

- Controls and badges: `rounded-md`
- Panels: `rounded-lg`
- Map: no radius on mobile full-bleed; `rounded-lg` when inset
- Hairline borders only: `border-border`

## Color tokens

Semantic theme variables live in `app/globals.css`. Do not hardcode hex in components.

| Token | Meaning |
| --- | --- |
| `--background` / `--foreground` | Page canvas and primary text |
| `--card` / `--muted` | Panels and secondary surfaces |
| `--border` / `--ring` | Dividers and focus |
| `--status-upcoming` | Scheduled, not started |
| `--status-active` / `--status-outage` | Happening now |
| `--status-completed` | Window has ended (`resolved` in ui.mdc) |
| `--status-cancelled` | Cancelled by source |

## Status

| Status | Label | Color role |
| --- | --- | --- |
| `upcoming` | Upcoming | amber |
| `active` | Active | red |
| `completed` | Completed | green |
| `cancelled` | Cancelled | muted zinc |

## Components

Build on shadcn/ui: `Button`, `Badge`, `Card`, `Tabs`, `Sheet`, `Skeleton`. Reuse `StatusBadge` for every status chip.

## Layout

1. Header: title, live/last-updated, refresh.
2. Map: OSM tiles, markers colored by computed status.
3. List: All / Upcoming / Active / Past tabs with counts.
4. Detail: sheet with windows, areas, reason, type, source link.

## States

- Loading: skeletons in list and a muted map placeholder.
- Empty: one short sentence per tab, no illustrations.
- Error: plain message plus retry.
- Failed parse: show title and source link; do not invent times or areas.
