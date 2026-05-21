export type ToastTone = "success" | "error" | "info";

export type ToastMessage = {
  id: number;
  tone: ToastTone;
  message: string;
};

function toneConfig(tone: ToastTone) {
  switch (tone) {
    case "success":
      return {
        bar: "bg-emerald-400",
        iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
        body: "border-emerald-200/60 bg-white/80 text-slate-800 dark:border-emerald-500/20 dark:bg-slate-900/80 dark:text-slate-100",
        shadow: "shadow-emerald-500/8 dark:shadow-emerald-500/6",
      };
    case "info":
      return {
        bar: "bg-sky-400",
        iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300",
        body: "border-sky-200/60 bg-white/80 text-slate-800 dark:border-sky-500/20 dark:bg-slate-900/80 dark:text-slate-100",
        shadow: "shadow-sky-500/8 dark:shadow-sky-500/6",
      };
    case "error":
      return {
        bar: "bg-rose-400",
        iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
        body: "border-rose-200/60 bg-white/80 text-slate-800 dark:border-rose-500/20 dark:bg-slate-900/80 dark:text-slate-100",
        shadow: "shadow-rose-500/8 dark:shadow-rose-500/6",
      };
  }
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M16.25 5.75 8.5 13.5 3.75 8.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tone === "info") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 14.25v-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 7.15h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 5.75v4.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="1.1" fill="currentColor" />
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ToastStack({ messages, onClose }: { messages: ToastMessage[]; onClose: (id: number) => void }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-2">
        {messages.map((toast) => {
          const c = toneConfig(toast.tone);

          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto relative flex overflow-hidden rounded-xl border backdrop-blur-md ${c.body} ${c.shadow} shadow-lg animate-slideDown`}
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${c.bar}`} />

              <div className="flex items-start gap-3 pl-4 pr-10 py-3 flex-1 min-w-0">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${c.iconBg}`}>
                  <ToastIcon tone={toast.tone} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5 text-[13px] leading-relaxed font-medium">
                  {toast.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onClose(toast.id)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close notification"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
