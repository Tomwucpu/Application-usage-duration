import { useT } from "../i18n";
import type { Locale } from "../i18n";
import type { AppSummary, HourlySummary } from "../types";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function formatMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function formatDuration(seconds: number, locale: Locale): string {
  const m = Math.floor(seconds / 60);
  if (locale === "zh-CN") {
    if (m >= 60) return `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`;
    return `${m} 分钟`;
  }
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

interface PieDataItem {
  name: string;
  value: number;
  percentage: number;
}

function buildPieData(apps: AppSummary[], totalSeconds: number, othersLabel: string): PieDataItem[] {
  const top7 = apps.slice(0, 7);
  const result: PieDataItem[] = top7.map((a) => ({
    name: a.app_name,
    value: a.total_seconds,
    percentage: a.percentage,
  }));

  const remainingSeconds = apps.slice(7).reduce((sum, a) => sum + a.total_seconds, 0);
  if (remainingSeconds > 0) {
    result.push({
      name: othersLabel,
      value: remainingSeconds,
      percentage: totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0,
    });
  }

  return result;
}

function buildHourlyData(hourly: HourlySummary[]): { hour: string; minutes: number }[] {
  const map = new Map<number, number>();
  for (const h of hourly) {
    map.set(h.hour, h.total_seconds);
  }
  const result: { hour: string; minutes: number }[] = [];
  for (let i = 0; i < 24; i++) {
    result.push({
      hour: `${String(i).padStart(2, "0")}:00`,
      minutes: formatMinutes(map.get(i) ?? 0),
    });
  }
  return result;
}

function CustomPieTooltip({ active, payload, locale }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: PieDataItem }>;
  locale: Locale;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-lg">
      <div className="text-slate-200 font-medium">{item.name}</div>
      <div className="text-slate-400">
        {formatDuration(item.value, locale)} ({item.percentage.toFixed(1)}%)
      </div>
    </div>
  );
}

function CustomHourlyTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { hour: string; minutes: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const { hour, minutes } = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-lg">
      <div className="text-slate-200 font-medium">{hour}</div>
      <div className="text-slate-400">
        {minutes > 0 ? `${minutes} min` : "0 min"}
      </div>
    </div>
  );
}

interface Props {
  apps: AppSummary[];
  totalSeconds: number;
  hourly: HourlySummary[];
}

export function UsageCharts({ apps, totalSeconds, hourly }: Props) {
  const { t, locale } = useT();
  const pieData = buildPieData(apps, totalSeconds, t("chart.others"));
  const hourlyData = buildHourlyData(hourly);

  if (apps.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12">{t("loading")}</div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Pie chart - app distribution */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-2">{t("chart.distribution")}</h2>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((_, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip locale={locale} />} isAnimationActive={false} />
            <Legend
              formatter={(value: string) => (
                <span className="text-slate-400 text-xs">{value}</span>
              )}
              iconType="circle"
              iconSize={8}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bar chart - hourly usage */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-2">{t("chart.hourly")}</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={hourlyData} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="hour"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}`}
            />
            <Tooltip content={<CustomHourlyTooltip />} />
            <Bar dataKey="minutes" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
