import type { ChangeInfo } from "../../utils/reportCalculations";

const ARROW_UP = (
  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
  </svg>
);

const ARROW_DOWN = (
  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
  </svg>
);

const DASH = (
  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  </svg>
);

const DIRECTION_STYLES: Record<string, string> = {
  up: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  down: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  new: "bg-purple-100 text-purple-700 font-bold dark:bg-purple-900/30 dark:text-purple-400",
};
const DEFAULT_STYLE = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";

function getStyle(direction: string) {
  return DIRECTION_STYLES[direction] ?? DEFAULT_STYLE;
}

const iconFor = (direction: string, text: string) => {
  if (direction === "up") return ARROW_UP;
  if (direction === "down") return ARROW_DOWN;
  if (direction === "same" && text === "—") return DASH;
  return null;
};

export function ChangeBadge({ change }: { change: ChangeInfo }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${getStyle(change.direction)}`}>
      {iconFor(change.direction, change.text)}
      <span>{change.direction === "same" && change.text === "—" ? "" : change.text}</span>
    </span>
  );
}

export function DiffBadge({ change }: { change: ChangeInfo }) {
  if (!change.diffText) return null;
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStyle(change.direction)}`}>
      {change.diffText}
    </span>
  );
}
