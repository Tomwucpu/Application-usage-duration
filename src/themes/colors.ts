// ============================================================
// Theme color tokens — single source of truth
// When modifying: also update the matching CSS custom properties
// in src/index.css (:root and .dark blocks)
// ============================================================

/* ── Chart palette (static, same in both themes) ── */
export const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
] as const;

export const CHART_OTHER_COLOR = "#475569";

/* ── Semantic accents (indigo family) ── */
export const ACCENT = {
  light: "#4f46e5",   // indigo-600
  dark:  "#6366f1",   // indigo-500
} as const;

/* ── Light mode surfaces ── */
export const LIGHT = {
  bgBody:        "#0f172a",          // body default (slate-900)
  bgInput:       "#ffffff",
  border:        "#e2e8f0",          // slate-200
  borderMuted:   "#64748b",          // slate-500
  textPrimary:   "#0f172a",          // slate-900
  textSecondary: "#334155",          // slate-700
  textMuted:     "#64748b",          // slate-500
  textDim:       "#94a3b8",          // slate-400
  textFaint:     "#cbd5e1",          // slate-300
  chartGrid:     "#e2e8f0",
  chartTick:     "#64748b",
  chartCursor:   "rgba(100,116,139,0.08)",
  dateArrow:     "#475569",
  dateDisplay:   "#0f172a",
  dateToday:     "#64748b",
  dateTodayDisabled: "#94a3b8",
  calMonthBtn:   "#64748b",
  calDayBtn:     "#334155",
  calDayMuted:   "#cbd5e1",
  calSelectedGradient: "#148aff",
} as const;

/* ── Dark mode surfaces ── */
export const DARK = {
  bgInput:       "#1e293b",          // slate-800
  border:        "#64748b",          // slate-500
  textPrimary:   "#f8fafc",          // slate-50
  textSecondary: "#cbd5e1",          // slate-300
  textMuted:     "#cbd5e1",          // slate-300
  textDim:       "#94a3b8",          // slate-400
  textFaint:     "#475569",          // slate-600
  chartGrid:     "#1e293b",
  chartTick:     "#94a3b8",
  chartCursor:   "rgba(148,163,184,0.08)",
  dateArrow:     "#cbd5e1",
  dateDisplay:   "#f8fafc",
  dateToday:     "#cbd5e1",
  dateTodayDisabled: "#64748b",
  calMonthBtn:   "#94a3b8",
  calDayBtn:     "#cbd5e1",
  calDayMuted:   "#475569",
  calSelectedGradient: "#148aff",
} as const;

/* ── CSS custom property names (match index.css) ── */
export const CSS_VAR = {
  primary:            "--color-primary",
  primaryRing:        "--color-primary-ring",
  primaryRingFocus:   "--color-primary-ring-focus",
  bgInput:            "--color-bg-input",
  border:             "--color-border",
  textPrimary:        "--color-text-primary",
  textSecondary:      "--color-text-secondary",
  textMuted:          "--color-text-muted",
  textDim:            "--color-text-dim",
  textFaint:          "--color-text-faint",
  chartGrid:          "--color-chart-grid",
  chartTick:          "--color-chart-tick",
  chartCursor:        "--color-chart-cursor",
  dateArrow:          "--color-date-arrow",
  dateDisplay:        "--color-date-display",
  dateToday:          "--color-date-today",
  dateTodayDisabled:  "--color-date-today-disabled",
  calMonthBtn:        "--color-cal-month-btn",
  calDayBtn:          "--color-cal-day-btn",
  calDayMuted:        "--color-cal-day-muted",
  calSelectedGradient:"--gradient-cal-selected",
} as const;
