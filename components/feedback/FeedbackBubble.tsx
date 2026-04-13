'use client';

import { useState } from 'react';
import type { FeedbackItem } from '@/types';

interface FeedbackBubbleProps {
  item: FeedbackItem;
  iframeRect: DOMRect | null;
  onConfirm: (id: string, text: string) => void;
  onStatusChange: (id: string, status: 'resolved' | 'unresolved') => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function FeedbackBubble({
  item,
  iframeRect,
  onConfirm,
  onStatusChange,
  onDelete,
  onClose,
}: FeedbackBubbleProps) {
  const [editText, setEditText] = useState(item.text);
  const [isEditing, setIsEditing] = useState(!item.text);

  const top = (iframeRect?.top ?? 0) + (item.elementRect?.top ?? 0);
  const left = (iframeRect?.left ?? 0) + (item.elementRect?.left ?? 0);

  return (
    <div
      data-testid="feedback-bubble"
      style={{ position: 'fixed', top, left, zIndex: 1000 }}
    >
      {/* Pin dot */}
      <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow-md" />

      {/* Popover card */}
      <div className="absolute top-4 left-0 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl p-3 flex flex-col gap-2">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
              item.status === 'resolved'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
            }`}
          >
            {item.status === 'resolved' ? 'Resolved' : 'Unresolved'}
          </span>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-xs"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {isEditing ? (
          <>
            <textarea
              data-testid="feedback-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              placeholder="Describe the change…"
              className="w-full text-sm border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <div className="flex gap-2">
              <button
                data-testid="feedback-add-btn"
                onClick={() => {
                  if (editText.trim()) {
                    onConfirm(item.id, editText.trim());
                    setIsEditing(false);
                  }
                }}
                className="flex-1 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded px-2 py-1.5 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 break-words">
              {item.text}
            </p>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
              >
                Edit
              </button>
              {item.status === 'unresolved' ? (
                <button
                  data-testid="feedback-resolve-btn"
                  onClick={() => onStatusChange(item.id, 'resolved')}
                  className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded border border-green-200 hover:border-green-300 dark:border-green-800"
                >
                  Resolve
                </button>
              ) : (
                <button
                  data-testid="feedback-unresolve-btn"
                  onClick={() => onStatusChange(item.id, 'unresolved')}
                  className="text-xs text-orange-600 hover:text-orange-700 px-2 py-1 rounded border border-orange-200 hover:border-orange-300 dark:border-orange-800"
                >
                  Re-open
                </button>
              )}
              <button
                data-testid="feedback-delete-btn"
                onClick={() => onDelete(item.id)}
                className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded border border-red-200 hover:border-red-300 dark:border-red-800"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
