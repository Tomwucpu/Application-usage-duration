// ============================================================
// Theme color tokens — single source of truth
// When modifying: also update the matching CSS custom properties
// in src/index.css (:root and .dark blocks)
// ============================================================

/* ── Chart palette (static, same in both themes) ── */
export const CHART_COLORS = [
  "#0091ea", "#ff5400", "#ffbd00", "#8ac926",
  "#00c853", "#00bfa5", "#00b8d4", "#b76100",
  "#ff0054", "#7c4dff", "#d500f9", "#ff4081",
] as const;

export const CHART_OTHER_COLOR = "#475569";
