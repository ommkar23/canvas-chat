'use client';

import { useRef, useEffect } from 'react';
import type { FeedbackItem } from '@/types';
import { FeedbackSummary } from '@/components/feedback/FeedbackSummary';

interface InputPanelProps {
  onSubmit: (prompt: string) => void;
  onSubmitFeedback: () => void;
  isStreaming: boolean;
  isFeedbackMode: boolean;
  feedbackItems: FeedbackItem[];
  onFeedbackItemClick: (id: string) => void;
  textValue: string;
  onTextChange: (text: string) => void;
}

export function InputPanel({
  onSubmit,
  onSubmitFeedback,
  isStreaming,
  isFeedbackMode,
  feedbackItems,
  onFeedbackItemClick,
  textValue,
  onTextChange,
}: InputPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSubmittedFeedback = feedbackItems.some((item) => item.text.trim().length > 0);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [textValue]);

  function handlePromptSubmit() {
    if (isStreaming) return;
    const text = (textareaRef.current?.value ?? textValue).trim();
    if (!text) return;
    onTextChange('');
    onSubmit(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (isFeedbackMode) {
        if (hasSubmittedFeedback && !isStreaming) {
          onSubmitFeedback();
        }
        return;
      }
      handlePromptSubmit();
    }
  }

  return (
    <div data-testid="input-panel" className="flex flex-col flex-1 overflow-hidden">
      {isFeedbackMode && feedbackItems.length > 0 && (
        <FeedbackSummary items={feedbackItems} onItemClick={onFeedbackItemClick} />
      )}

      <div className="flex flex-col flex-1 p-3 gap-2 overflow-y-auto">
        <textarea
          ref={textareaRef}
          data-testid="textarea"
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isFeedbackMode
              ? 'Optional extra instruction for the feedback submission…'
              : 'Describe what you want to build…'
          }
          rows={4}
          disabled={isStreaming}
          className="w-full resize-none rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent placeholder:text-neutral-400 dark:placeholder:text-neutral-600 min-h-[6rem] disabled:opacity-60 transition-colors"
        />

        {isFeedbackMode ? (
          <>
            <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50/80 dark:bg-orange-950/40 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
              Feedback mode is active. Tap elements on the canvas to add floating feedback dots. Exit feedback mode to return to view mode.
            </div>
            {hasSubmittedFeedback && (
              <button
                data-testid="submit-btn"
                onClick={onSubmitFeedback}
                disabled={isStreaming}
                className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-600 text-white font-medium text-sm py-2 px-4 transition-colors"
              >
                {isStreaming ? 'Submitting…' : 'Submit Feedback'}
              </button>
            )}
          </>
        ) : (
          <button
            data-testid="submit-btn"
            onClick={handlePromptSubmit}
            disabled={isStreaming}
            className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-600 text-white font-medium text-sm py-2 px-4 transition-colors"
          >
            {isStreaming ? 'Generating…' : 'Generate'}
          </button>
        )}
      </div>
    </div>
  );
}
