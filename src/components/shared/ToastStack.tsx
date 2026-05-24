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
        icon: "text-emerald-500 dark:text-emerald-400",
        body: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200",
        close: "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100/80 dark:text-emerald-300 dark:hover:text-emerald-100 dark:hover:bg-emerald-500/10",
      };
    case "info":
      return {
        icon: "text-sky-500 dark:text-sky-400",
        body: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200",
        close: "text-sky-400 hover:text-sky-600 hover:bg-sky-100/80 dark:text-sky-300 dark:hover:text-sky-100 dark:hover:bg-sky-500/10",
      };
    case "error":
      return {
        icon: "text-rose-500 dark:text-rose-400",
        body: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200",
        close: "text-rose-400 hover:text-rose-600 hover:bg-rose-100/80 dark:text-rose-300 dark:hover:text-rose-100 dark:hover:bg-rose-500/10",
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
    <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-[420px] flex-col gap-3">
        {messages.map((toast) => {
          const c = toneConfig(toast.tone);

          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto relative flex items-center gap-3 rounded-lg border px-4 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.12)] animate-slideDown dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)] ${c.body}`}
            >
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center ${c.icon}`}>
                <ToastIcon tone={toast.tone} />
              </div>

              <div className="min-w-0 flex-1 text-sm leading-6 font-medium">
                {toast.message}
              </div>

              <button
                type="button"
                onClick={() => onClose(toast.id)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${c.close}`}
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
