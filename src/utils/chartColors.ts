import { CHART_COLORS, CHART_OTHER_COLOR } from "../themes/colors";

export function getSeriesOrder(totals: Map<string, number>): string[] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

export function buildSeriesColorMap(names: string[], othersLabel: string | null): Record<string, string> {
  const colorMap: Record<string, string> = {};

  names.forEach((name, index) => {
    colorMap[name] = CHART_COLORS[index % CHART_COLORS.length];
  });

  if (othersLabel) {
    colorMap[othersLabel] = CHART_OTHER_COLOR;
  }

  return colorMap;
}
