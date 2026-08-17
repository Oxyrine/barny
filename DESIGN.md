---
name: NetWatch
description: A dark glass instrument panel for automated Wi-Fi diagnostics and ISP ticketing
colors:
  bg: "hsl(0, 0%, 0%)"
  surface: "hsl(0, 0%, 4%)"
  surface-2: "hsl(0, 0%, 8%)"
  border: "hsla(0, 0%, 100%, 0.1)"
  text: "hsl(0, 0%, 100%)"
  text-dim: "hsl(0, 0%, 55%)"
  accent: "hsl(0, 0%, 100%)"
  accent-dim: "hsl(0, 0%, 30%)"
  good: "hsl(142, 70%, 50%)"
  good-bg: "hsl(142, 40%, 10%)"
  degraded: "hsl(40, 90%, 58%)"
  degraded-bg: "hsl(40, 50%, 10%)"
  critical: "hsl(0, 80%, 58%)"
  critical-bg: "hsl(0, 40%, 10%)"
  grade-b: "hsl(100, 60%, 48%)"
  grade-d: "hsl(25, 90%, 55%)"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
  mono:
    fontFamily: "Geist Pixel Circle, Fira Code, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.04em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "hsl(220, 15%, 5%)"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 20px"
  button-ghost:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 20px"
  card:
    backgroundColor: "hsla(0, 0%, 100%, 0.03)"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "{spacing.6}"
  status-badge-good:
    backgroundColor: "hsla(142, 70%, 50%, 0.1)"
    textColor: "{colors.good}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  status-badge-critical:
    backgroundColor: "hsla(0, 80%, 58%, 0.1)"
    textColor: "{colors.critical}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: NetWatch

## 1. Overview

**Creative North Star: "The Glass Instrument Panel"**

NetWatch reads a home network's health the way a cockpit instrument panel reads altitude and airspeed: precise glowing readouts on true black glass, calm at rest, and only ever loud when something genuinely needs attention. The surface is matte black, not navy or charcoal, every card is frosted glass floating over it with a soft inner highlight, and color is rationed: white and gray carry the interface, and the only saturated colors on screen are the three status hues (good, degraded, critical) plus a five-step bufferbloat grade scale, both of which are functional signals, never decoration.

This system explicitly rejects a chrome-and-shadow "dashboard software" look; there is no drop-shadow vocabulary here, depth comes from blur and translucency, not elevation stacking. It also rejects alarm-red panic UI, a Critical status still renders as a quiet glowing pill with a label, not a flashing banner, because the product's whole premise is staying calm and precise while explaining a real problem to a stressed, non-technical subscriber.

**Key Characteristics:**
- True black background, never navy or charcoal
- Frosted glass cards (blur, not shadow) as the primary surface language
- One neutral accent (white) plus three status hues, nothing else saturated
- Monospace numerals for anything measured (latency, throughput, RSSI); Inter for everything read as language
- Status is always icon/label + color, never color alone

## 2. Colors

The palette is almost entirely achromatic: true black, white, and a five-step gray scale, with color reserved strictly for status and diagnostic grading.

### Primary
- **Signal White** (hsl(0, 0%, 100%)): the sole UI accent — primary buttons, the nav logo mark, active nav-link backgrounds, focus rings, and the metric-value text-glow. Used sparingly against black so it reads as "the interface speaking," not decoration.

### Neutral
- **Void** (hsl(0, 0%, 0%) / `--c-bg`): page background. Pure matte black, not a near-black tint.
- **Frosted Obsidian** (hsl(0, 0%, 4%) / `--c-surface`): the base glass-card fill before its translucency layer.
- **Deep Charcoal** (hsl(0, 0%, 8%) / `--c-surface-2`): input fields, secondary buttons, telemetry chips — one step lighter than card surfaces so form controls read as "sunken" relative to cards.
- **Hairline White** (hsla(0, 0%, 100%, 0.1) / `--c-border`): the only border color in the system, a translucent white hairline used identically on nav, cards, badges, and inputs.
- **Ink White** (hsl(0, 0%, 100%) / `--c-text`): primary text.
- **Signal Gray** (hsl(0, 0%, 55%) / `--c-text-dim`): secondary text, labels, subtitles, table headers.

### Status (functional, not decorative)
- **Clear Green** (hsl(142, 70%, 50%) / `--c-good`): healthy status, resolved tickets, grade A.
- **Caution Amber** (hsl(40, 90%, 58%) / `--c-degraded`): degraded status, in-progress tickets, grade C.
- **Alert Red** (hsl(0, 80%, 58%) / `--c-critical`): critical status, churn-risk flags, grade F.

Each status color ships with a matching `-bg` token (a near-black tint of the same hue, e.g. `--c-good-bg: hsl(142, 40%, 10%)`) used for toast backgrounds, never for badges, which instead use a 10% alpha of the status color directly over the glass surface.

### Named Rules
**The One-Accent Rule.** White is the only non-functional color in the entire system. If a new element needs visual weight, reach for opacity, blur, or size before reaching for a new hue.

**The Color-Plus-Label Rule.** No status is ever conveyed by color alone. Every status badge, nav dot, and metric pairs its color with an icon or text label (this is a PRODUCT.md accessibility requirement, not a stylistic choice).

## 3. Typography

**Body Font:** Inter (with system-ui, sans-serif fallback)
**Label/Mono Font:** Geist Pixel Circle (with Fira Code, monospace fallback)

**Character:** Inter carries everything read as language — labels, nav, body copy, button text — quiet and highly legible at small sizes. The monospace face is reserved for anything measured: latency in ms, throughput in Mbps, RSSI in dBm, bufferbloat grades, table values. The pairing is the instrument-panel logic made literal: prose is human, numbers are readout.

### Hierarchy
- **Card value** (500 weight, 2.2rem, 1.1 line-height, mono, -0.04em tracking): the single most important number on a card — latency, throughput, RSSI — with a soft white text-glow for emphasis.
- **Page title** (500 weight, 2.25rem, -0.04em tracking): top-of-page heading. Currently resolves to Inter (the `--font-display` token it references is only defined inside the landing page's scope, so outside Landing this variable is unset and the browser falls back to the inherited body font). Treat Inter as the honest current value for dashboard page titles until that token is either defined globally or the rule is repointed at the mono face.
- **Section title** (600 weight, 1rem, -0.01em tracking): card-group and panel headers.
- **Card title / table header** (600 weight, 0.75rem, uppercase, 0.1em tracking): the small caps label above every metric card and every table column.
- **Body** (400 weight, 0.9375rem, 1.6 line-height): default paragraph and UI text.
- **Field hint / error** (400 weight, 0.75rem): helper and validation text beneath form inputs.

### Named Rules
**The Readout Rule.** Any number that came from a live measurement (latency, throughput, RSSI, packet loss %, byte counts) renders in the mono face with tabular figures. Any number that's just UI chrome (a count in a nav badge, for instance) does not need to follow this rule, but in practice nearly every visible number on this dashboard is a real reading, so default to mono.

## 4. Elevation

Frosted glass over true black. There is no drop-shadow vocabulary in this system; depth comes from `backdrop-filter: blur()` plus a translucent white border plus a soft inset highlight, never from a dark shadow cast onto the black background (a black-on-black shadow is invisible anyway). The one exception is a diffuse ambient shadow used purely to lift the nav pill and cards very slightly off the page, tinted toward black at low opacity, not toward any color.

### Shadow Vocabulary
- **Card elevation** (`box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 1px hsla(0,0%,100%,0.1)`, `backdrop-filter: blur(24px)`): the default glass-card treatment. The inset highlight simulates a light catching the top edge of a pane of glass.
- **Nav elevation** (`box-shadow: 0 4px 14px rgba(0,0,0,0.5)`, `backdrop-filter: blur(24px)`): the sticky pill nav, slightly heavier shadow since it floats above scrolling content.
- **Badge glow** (`box-shadow: 0 0 12px hsla(<status-hue>, 70%, 50%, 0.1)`, `backdrop-filter: blur(12px)`): status badges get a soft glow in their own hue instead of a shadow, reinforcing that they're a light source (a signal), not a raised object.

### Named Rules
**The No-Cast-Shadow Rule.** Never add a plain dark `box-shadow` for elevation. On true black it does nothing. Depth is blur + translucent border + inset highlight, full stop.

## 5. Components

Every interactive surface in this system is glass first: translucent fill, blurred backdrop, a hairline white border. Nothing here is opaque chrome.

### Buttons
- **Shape:** 6px radius (`--r-sm`), never pill-shaped except the nav and status badges specifically.
- **Primary:** white fill, near-black text (`hsl(220,15%,5%)`), 600 weight, `8px 20px` padding (`--sp-2 --sp-5`). Scales to 0.97 on `:active` for tactile press feedback.
- **Ghost:** `--c-surface-2` fill, full-opacity text, 1px hairline border. Used for secondary actions (Cancel, close, non-destructive alternates).
- **Hover:** primary shifts toward a themeable hue channel (`--hue-accent`, currently `0`) rather than simply lightening white — worth reviewing, since at the current `--hue-accent: 0` this produces a faint warm-red tint on hover that doesn't obviously read as "the white button, but brighter." See Do's and Don'ts.

### Status Badge
- **Style:** pill radius (999px), 10% alpha of the status hue as background, full-opacity status hue as text and border, 12px blur, small glow shadow in the same hue.
- **Variants:** `good` / `degraded` / `critical` (health status), `open` / `in-progress` / `resolved` (ticket status), `Minor` / `Degraded` / `Critical` (ticket severity, capitalized to match the TicketSeverity union type directly).

### Grade Badge
- **Shape:** 28px circle, mono numeral/letter, 1px hairline border in the grade's own hue, 8px blur.
- **Scale:** A (green) → B (yellow-green) → C (amber) → D (orange) → F (red), one continuous hue sweep from good to critical.

### Cards / Containers
- **Corner style:** 24px radius (`--r-xl`), the roomiest radius in the system, reserved for cards specifically so they read as the primary surface.
- **Background:** `hsla(0,0%,100%,0.03)`, 3% white over black.
- **Border:** 1px hairline white at 10% alpha.
- **Hover:** border brightens to 18% alpha and fill brightens to 5%; a quiet "this is interactive" cue, not a lift or scale.
- **Internal padding:** 24px (`--sp-6`).

### Inputs / Fields
- **Style:** `--c-surface-2` fill, hairline border, 6px radius, mono type (form values are almost always numbers: thresholds, intervals, cooldowns).
- **Focus:** border shifts to the accent color plus a 3px soft ring in the themeable hue.
- **Error:** border and ring shift to critical red.
- **Label placement:** always above the input, `--c-text-dim`, 500 weight, 0.8125rem — never a floating or placeholder-as-label pattern.

### Navigation
- **Style:** a single sticky pill (999px radius) floating with margin on all sides, not a full-width bar. 58px tall, 24px blur, translucent white fill at 5% opacity.
- **Links:** `--c-text-dim` at rest, full white on hover/active, active state adds a 15%-opacity white pill background with a subtle inset highlight.
- **Status dot:** a 7px dot at the nav's trailing edge, colored by live health status, pulsing when degraded or critical, this is the one place a raw color-only signal exists in the system, and it is always paired with the tooltip/aria-label text stating the status in words.
- **Mobile:** collapses to a burger-triggered full-screen overlay with a white pill menu card (the landing page's nav specifically; the dashboard nav itself does not yet have a documented mobile collapse pattern beyond the CSS grid reflow).

## 6. Do's and Don'ts

### Do:
- **Do** keep the palette to white + five grays + three status hues + the five-step grade scale. Nothing else.
- **Do** pair every status color with an icon or text label; color alone never carries meaning, per PRODUCT.md's accessibility principle.
- **Do** use the mono face (`--font-mono`) for any number sourced from a live measurement.
- **Do** build depth with `backdrop-filter: blur()` + a translucent white border + an inset highlight. Never a plain dark box-shadow.
- **Do** keep the accent to a single hue (white). Do not introduce a second "brand color."
- **Do** write a Critical ticket's UI the same calm way as a Minor one; the escalation is in the words and the color, not in added visual noise.

### Don't:
- **Don't** use gradient text, glow-outline neon, or any AI-slop tell not already in this system.
- **Don't** add drop shadows for elevation; on true black they're invisible and just add render cost.
- **Don't** introduce a second accent color. If something needs more visual weight, use opacity or size, not a new hue.
- **Don't** leave `.page-title` (and anything else) referencing `--font-display` without defining that token outside the landing page's scope; either define it globally or repoint dashboard headings at `--font-mono` intentionally.
- **Don't** ship the primary button's hover state without checking what `--hue-accent: 0` actually renders as against a pure-white resting state; confirm the warm-red tint is intended before shipping more surfaces that use it.
- **Don't** use a border-left/border-right colored stripe as a card accent; this system has no such pattern and it would clash with the hairline-border language everywhere else.
