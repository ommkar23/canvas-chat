'use client';

import type { FeedbackItem } from '@/types';

interface FeedbackSummaryProps {
  items: FeedbackItem[];
  onItemClick: (id: string) => void;
}

export function FeedbackSummary({ items, onItemClick }: FeedbackSummaryProps) {
  if (items.length === 0) return null;

  return (
    <div data-testid="feedback-summary" className="border-b border-neutral-200 dark:border-neutral-800 px-3 py-2 flex flex-col gap-1">
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
        Feedback ({items.length})
      </p>
      {items.map((item) => (
        <button
          key={item.id}
          data-testid="feedback-summary-item"
          onClick={() => onItemClick(item.id)}
          className="flex items-center justify-between gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate flex-1">
            {item.text.length > 40 ? item.text.slice(0, 40) + '…' : item.text || '(no text)'}
          </span>
          <span
            className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${
              item.status === 'resolved'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
            }`}
          >
            {item.status === 'resolved' ? '✓' : '●'}
          </span>
        </button>
      ))}
    </div>
  );
}
