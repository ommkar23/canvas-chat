'use client';

interface TopBarProps {
  isFeedbackMode: boolean;
}

export function TopBar({ isFeedbackMode }: TopBarProps) {
  return (
    <div
      data-testid="top-bar"
      className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0"
    >
      <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm tracking-tight">
        Canvas Chat
      </span>
      <div className="flex items-center gap-3">
        {isFeedbackMode && (
          <span
            data-testid="feedback-badge"
            className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-medium text-white"
          >
            ● Feedback Mode
          </span>
        )}
        <span className="text-xs text-neutral-400 dark:text-neutral-500 hidden sm:block">
          F — feedback · ⌘↵ — generate · ⌘Z / ⌘⇧Z — versions
        </span>
      </div>
    </div>
  );
}
