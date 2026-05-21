export type ToastTone = "success" | "error" | "info";

export type ToastMessage = {
  id: number;
  tone: ToastTone;
  message: string;
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M16.25 5.75 8.5 13.5 3.75 8.75"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (tone === "info") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 14.25v-4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M10 7.15h.01"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 5.75v4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
      <div className="flex w-full max-w-sm flex-col gap-3">
        {messages.map((toast) => {
          const toneClasses =
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-emerald-950/10 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
              : toast.tone === "info"
                ? "border-sky-200 bg-sky-50 text-sky-900 shadow-sky-950/10 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
                : "border-rose-200 bg-rose-50 text-rose-900 shadow-rose-950/10 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100";

          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${toneClasses}`}
            >
              <div className="mt-0.5 shrink-0">
                <ToastIcon tone={toast.tone} />
              </div>
              <div className="min-w-0 flex-1 text-sm leading-5">{toast.message}</div>
              <button
                type="button"
                onClick={() => onClose(toast.id)}
                className="shrink-0 rounded-md p-1 transition-opacity hover:opacity-70"
                aria-label="Close notification"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}