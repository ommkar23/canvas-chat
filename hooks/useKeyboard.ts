'use client';

import { useEffect } from 'react';

interface UseKeyboardOptions {
  onFeedbackToggle?: () => void;
  onSubmit?: () => void;
  onEscape?: () => void;
  onVersionPrev?: () => void;
  onVersionNext?: () => void;
}

export function useKeyboard({
  onFeedbackToggle,
  onSubmit,
  onEscape,
  onVersionPrev,
  onVersionNext,
}: UseKeyboardOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Escape works everywhere
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      // Meta+Enter or Ctrl+Enter — submit (works even in textarea via explicit check)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        onSubmit?.();
        return;
      }

      // Meta+Shift+Z — version next
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        onVersionNext?.();
        return;
      }

      // Meta+Z (no Shift) — version prev
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        onVersionPrev?.();
        return;
      }

      // Skip remaining shortcuts if in input
      if (isInput) return;

      // F — feedback toggle
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onFeedbackToggle?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onFeedbackToggle, onSubmit, onEscape, onVersionPrev, onVersionNext]);
}
