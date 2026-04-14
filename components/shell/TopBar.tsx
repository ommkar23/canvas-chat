'use client';

interface TopBarProps {
  isFeedbackMode: boolean;
  onViewMode: () => void;
  onFeedbackMode: () => void;
}

export function TopBar({ isFeedbackMode, onViewMode, onFeedbackMode }: TopBarProps) {
  return (
    <div
      data-testid="top-bar"
      className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shrink-0"
    >
      <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm tracking-tight">
        Canvas Chat
      </span>
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-0.5">
          <button
            type="button"
            onClick={onViewMode}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !isFeedbackMode
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            View Mode
          </button>
          <button
            type="button"
            onClick={onFeedbackMode}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isFeedbackMode
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            Feedback Mode
          </button>
        </div>
        {isFeedbackMode && (
          <span
            data-testid="feedback-badge"
            className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-medium text-white"
          >
            ● Feedback Mode
          </span>
        )}
        <span className="text-xs text-neutral-400 dark:text-neutral-500 hidden sm:block">
          F — toggle mode · ⌘↵ — generate · ⌘Z / ⌘⇧Z — versions
        </span>
      </div>
    </div>
  );
}
