# Design System Specification: Professional Energy Trading Desk

## 1. Persona & Mental Model
**Target User:** Day-Ahead Power Trader / Shift Dispatcher under 11:00/12:00 gate auction time pressure.
- **Goals:** Rapid situational awareness, zero ambiguity regarding time horizons and publication cutoff, high data density, confidence in empirical error boundaries.
- **Aesthetic Benchmark:** Bloomberg Terminal, Grafana, Linear, Stripe Dashboard. Utilitarian, sharp, calm, high-contrast, zero decorative noise (no glassmorphism, no bright novelty gradients, no rounded cartoon pills).

---

## 2. Color System & Semantic Intent

### Neutral Architecture (Graphite / Slate)
- **Dark Theme (Default):** True deep graphite background (`#0d1117`), elevated card surfaces (`#161b22`), crisp 1px borders (`#30363d`), high-contrast tabular figures (`#f0f6fc`).
- **Light Theme:** Cool industrial grey background (`#f6f8fa`), elevated crisp white surfaces (`#ffffff`), structured 1px borders (`#d0d7de`), deep graphite text (`#1f2328`).

### Data Semantics (Colorblind-Safe)
| Meaning | Dark Mode | Light Mode | Rationale |
| :--- | :--- | :--- | :--- |
| **Forecast** (Primary Accent) | `#38bdf8` (Calm Sky Blue) | `#0284c7` (Deep Cobalt) | High legibility against dark slate; distinct from outturns. |
| **Actual Outturns** | `#e6edf3` (Off-White) | `#0f172a` (Near-Black) | Outturn is historical ground truth; rendered neutrally solid without chromatic bias. |
| **Uncertainty Envelope (P10–P90)** | `rgba(56, 189, 248, 0.12)` | `rgba(2, 132, 199, 0.10)` | Low-opacity fill linked chromatically to the forecast. |
| **Over-forecast (Long)** | `#f59e0b` (Amber Ochre) | `#d97706` (Burnt Amber) | Utility bought excess generation. |
| **Under-forecast (Short)** | `#6366f1` (Indigo Violet) | `#4f46e5` (Deep Indigo) | Distinguishable for deuteranopia/protanopia; avoids red/green confusion. |
| **Error / Alert** | `#f85149` | `#cf222e` | Used only for failed API connections or missing data. |

---

## 3. Typography & Numerical Precision
- **Body & UI Font:** Inter, -apple-system, system-ui, sans-serif.
- **Numbers & Axes:** JetBrains Mono / SFMono / ui-monospace with `font-variant-numeric: tabular-nums lining-nums`. Zero digit wobble across real-time updates.
- **Scale:**
  - `text-xs` (11px / 12px): Metric labels (uppercase, letter-spaced +0.05em, muted color).
  - `text-sm` (13px / 14px): Table rows, tooltips, filter dropdown inputs.
  - `text-base` (16px): Section card titles.
  - `text-xl` (20px): Secondary totals, drift magnitudes.
  - `text-2xl` (28px, font-semibold): Primary hero KPI values.

---

## 4. Spacing, Borders & Radius
- **Grid:** Strict 4px / 8px incremental scale (padding: 8px, 12px, 16px; gap: 8px, 12px, 16px).
- **Border Radius:** Fixed 4px (inputs, badges, buttons) to 6px (cards, containers). No oversized pill radius.
- **Borders:** Crisp, 1px solid borders (`border: 1px solid var(--border-subtle)`). No drop shadows greater than 2px.

---

## 5. Charting Standards
- **Line Width:** 1.5px continuous.
- **Gridlines:** Subtle 1px dashed lines (`#21262d` dark / `#e1e4e8` light) on the Y-axis only.
- **No Chart Borders:** Charts bleed cleanly into container padding.
- **Tooltips:** Compact, tabular layout with right-aligned MW values and fixed London wall-clock headers.
- **Empty & Loading States:** Linear skeleton pulse blocks matching the exact dimensions of KPI cards and charts (no generic spinning wheels).
