'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { VersionEntry, FeedbackItem, SSEEvent, ElementRect } from '@/types';
import { TopBar } from '@/components/shell/TopBar';
import { CanvasPanel } from '@/components/shell/CanvasPanel';
import { InputPanel } from '@/components/shell/InputPanel';
import { VersionBar } from '@/components/shell/VersionBar';
import { useKeyboard } from '@/hooks/useKeyboard';
import {
  wrapElementWithFeedback,
  extractHtml,
  setFeedbackStatus,
  removeFeedback,
  updateFeedbackText,
} from '@/lib/feedback/htmlEncoder';

const MAX_VERSIONS = 20;
const DEFAULT_FEEDBACK_PROMPT = 'Please incorporate all unresolved user feedback in the current canvas.';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentHtml, setCurrentHtml] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFeedbackMode, setIsFeedbackMode] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const activeFeedbackTargetRef = useRef<{ targetId: string } | null>(null);
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);
  const [iframeRect, setIframeRect] = useState<DOMRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const appRootRef = useRef<HTMLDivElement | null>(null);
  const lastPromptRef = useRef('');

  useEffect(() => {
    fetch('/api/sessions', { method: 'POST' })
      .then((res) => res.json())
      .then((data: { sessionId: string }) => setSessionId(data.sessionId))
      .catch(() => setError('Failed to create session'));
  }, []);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('[data-testid="canvas-iframe"]');
    iframeRef.current = iframe;
  });

  useEffect(() => {
    if (!isFeedbackMode) {
      setActiveBubbleId(null);
      activeFeedbackTargetRef.current = null;
      appRootRef.current?.focus();
    }
  }, [isFeedbackMode]);

  const enterViewMode = useCallback(() => {
    setIsFeedbackMode(false);
  }, []);

  const enterFeedbackMode = useCallback(() => {
    setIsFeedbackMode(true);
  }, []);

  const toggleFeedbackMode = useCallback(() => {
    setIsFeedbackMode((value) => !value);
  }, []);

  const handleIframeRectChange = useCallback((rect: DOMRect) => {
    setIframeRect(rect);
  }, []);

  const clearPendingFeedbackTarget = useCallback(() => {
    const targetId = activeFeedbackTargetRef.current?.targetId;
    if (!targetId) return;

    const contentDoc = iframeRef.current?.contentDocument;
    contentDoc
      ?.querySelector(`[data-feedback-target-id="${targetId}"]`)
      ?.removeAttribute('data-feedback-target-id');
    activeFeedbackTargetRef.current = null;
  }, []);

  const submitTurn = useCallback(
    async (prompt: string) => {
      if (!sessionId || isStreaming) return;

      lastPromptRef.current = prompt;
      setIsStreaming(true);
      setError(null);

      try {
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, prompt, contextHtml: currentHtml }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              if (event.type === 'done') {
                const finalHtml = event.html;
                setCurrentHtml(finalHtml);
                setVersions((prev) => {
                  const newEntry: VersionEntry = {
                    version: event.version,
                    timestamp: new Date().toISOString(),
                    prompt: lastPromptRef.current,
                    html: finalHtml,
                  };
                  const updated = [...prev, newEntry];
                  return updated.length > MAX_VERSIONS ? updated.slice(-MAX_VERSIONS) : updated;
                });
                setCurrentVersionIndex(-1);
                setIsStreaming(false);
              } else if (event.type === 'error') {
                setError(event.message);
                setIsStreaming(false);
              }
            } catch {
              // malformed SSE line — skip
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming, currentHtml]
  );

  const handleRetry = useCallback(() => {
    if (lastPromptRef.current) {
      setError(null);
      submitTurn(lastPromptRef.current);
    }
  }, [submitTurn]);

  const handlePromptSubmit = useCallback(
    (prompt: string) => {
      if (!prompt.trim()) return;
      setPromptText('');
      submitTurn(prompt.trim());
    },
    [submitTurn]
  );

  const handleFeedbackSubmit = useCallback(() => {
    const text = promptText.trim() || DEFAULT_FEEDBACK_PROMPT;
    setPromptText('');
    setActiveBubbleId(null);
    setIsFeedbackMode(false);
    submitTurn(text);
  }, [promptText, submitTurn]);

  const handleFeedbackClick = useCallback((targetId: string, rect: ElementRect) => {
    activeFeedbackTargetRef.current = { targetId };
    const id = uuidv4();
    const pendingItem: FeedbackItem = {
      id,
      text: '',
      status: 'unresolved',
      timestamp: new Date().toISOString(),
      elementRect: rect,
    };
    setFeedbackItems((prev) => [...prev, pendingItem]);
    setActiveBubbleId(id);
  }, []);

  const handleFeedbackConfirm = useCallback(
    (id: string, text: string) => {
      const item = feedbackItems.find((f) => f.id === id);
      if (!item) return;

      const contentDoc = iframeRef.current?.contentDocument;
      if (!contentDoc) return;

      if (!item.text) {
        const targetId = activeFeedbackTargetRef.current?.targetId ?? '';
        const wrapped = wrapElementWithFeedback(contentDoc, targetId, id, text, item.elementRect);
        if (!wrapped) return;
        activeFeedbackTargetRef.current = null;
      } else {
        const updated = updateFeedbackText(contentDoc, id, text);
        if (!updated) return;
      }

      const newHtml = extractHtml(contentDoc);
      setCurrentHtml(newHtml);
      setFeedbackItems((prev) => prev.map((f) => (f.id === id ? { ...f, text } : f)));
      setActiveBubbleId(id);
    },
    [feedbackItems]
  );

  const handleFeedbackStatusChange = useCallback((id: string, status: 'resolved' | 'unresolved') => {
    const contentDoc = iframeRef.current?.contentDocument;
    if (contentDoc) {
      setFeedbackStatus(contentDoc, id, status);
      setCurrentHtml(extractHtml(contentDoc));
    }
    setFeedbackItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
  }, []);

  const handleFeedbackDelete = useCallback(
    (id: string) => {
      const contentDoc = iframeRef.current?.contentDocument;
      if (contentDoc) {
        removeFeedback(contentDoc, id);
        setCurrentHtml(extractHtml(contentDoc));
      }
      setFeedbackItems((prev) => prev.filter((f) => f.id !== id));
      if (activeBubbleId === id) {
        setActiveBubbleId(null);
      }
      if (feedbackItems.find((f) => f.id === id && !f.text)) {
        clearPendingFeedbackTarget();
      }
    },
    [activeBubbleId, clearPendingFeedbackTarget, feedbackItems]
  );

  const handleFeedbackItemsChange = useCallback((items: FeedbackItem[]) => {
    setFeedbackItems((prev) => {
      const pending = prev.filter((item) => !item.text.trim());
      const merged = [...items];

      for (const item of pending) {
        if (!merged.some((candidate) => candidate.id === item.id)) {
          merged.push(item);
        }
      }

      const isSame =
        prev.length === merged.length &&
        prev.every((item, index) => {
          const next = merged[index];
          if (!next) return false;

          const sameRect =
            item.elementRect?.top === next.elementRect?.top &&
            item.elementRect?.left === next.elementRect?.left &&
            item.elementRect?.width === next.elementRect?.width &&
            item.elementRect?.height === next.elementRect?.height &&
            item.elementRect?.bottom === next.elementRect?.bottom &&
            item.elementRect?.right === next.elementRect?.right;

          return (
            item.id === next.id &&
            item.text === next.text &&
            item.status === next.status &&
            item.timestamp === next.timestamp &&
            sameRect
          );
        });

      return isSame ? prev : merged;
    });
  }, []);

  const handleFeedbackItemClick = useCallback((id: string) => {
    if (!isFeedbackMode) return;
    setActiveBubbleId(id);
  }, [isFeedbackMode]);

  const handleBubbleClose = useCallback(() => {
    if (activeBubbleId) {
      const item = feedbackItems.find((f) => f.id === activeBubbleId);
      if (item && !item.text) {
        setFeedbackItems((prev) => prev.filter((f) => f.id !== activeBubbleId));
        clearPendingFeedbackTarget();
      }
    }
    setActiveBubbleId(null);
  }, [activeBubbleId, clearPendingFeedbackTarget, feedbackItems]);

  const handleVersionSelect = useCallback(
    (index: number) => {
      if (versions[index]) {
        setCurrentVersionIndex(index);
        setCurrentHtml(versions[index].html);
      }
    },
    [versions]
  );

  const handleVersionRestore = useCallback(
    (index: number) => {
      if (versions[index]) {
        setCurrentHtml(versions[index].html);
        setCurrentVersionIndex(-1);
      }
    },
    [versions]
  );

  const handleVersionPrev = useCallback(() => {
    if (versions.length === 0) return;
    if (currentVersionIndex === -1) {
      setCurrentVersionIndex(versions.length - 1);
      setCurrentHtml(versions[versions.length - 1].html);
    } else if (currentVersionIndex > 0) {
      const next = currentVersionIndex - 1;
      setCurrentVersionIndex(next);
      setCurrentHtml(versions[next].html);
    }
  }, [versions, currentVersionIndex]);

  const handleVersionNext = useCallback(() => {
    if (versions.length === 0) return;
    if (currentVersionIndex === -1) return;
    if (currentVersionIndex < versions.length - 1) {
      const next = currentVersionIndex + 1;
      setCurrentVersionIndex(next);
      setCurrentHtml(versions[next].html);
    } else {
      setCurrentVersionIndex(-1);
    }
  }, [versions, currentVersionIndex]);

  const handleEscape = useCallback(() => {
    if (activeBubbleId) {
      handleBubbleClose();
    } else if (isFeedbackMode) {
      setIsFeedbackMode(false);
    }
  }, [activeBubbleId, handleBubbleClose, isFeedbackMode]);

  const handleKeyboardSubmit = useCallback(() => {
    if (isStreaming) return;
    if (isFeedbackMode) {
      if (feedbackItems.some((item) => item.text.trim().length > 0)) {
        handleFeedbackSubmit();
      }
      return;
    }
    if (promptText.trim()) {
      handlePromptSubmit(promptText);
    }
  }, [feedbackItems, handleFeedbackSubmit, handlePromptSubmit, isFeedbackMode, isStreaming, promptText]);

  useKeyboard({
    onFeedbackToggle: toggleFeedbackMode,
    onSubmit: handleKeyboardSubmit,
    onEscape: handleEscape,
    onVersionPrev: handleVersionPrev,
    onVersionNext: handleVersionNext,
  });

  return (
    <div ref={appRootRef} tabIndex={-1} className="flex flex-col h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 focus:outline-none">
      <TopBar
        isFeedbackMode={isFeedbackMode}
        onViewMode={enterViewMode}
        onFeedbackMode={enterFeedbackMode}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-3/4 relative overflow-hidden border-r border-neutral-200 dark:border-neutral-800">
          <CanvasPanel
            html={currentHtml}
            isStreaming={isStreaming}
            isFeedbackMode={isFeedbackMode}
            feedbackItems={feedbackItems}
            activeBubbleId={activeBubbleId}
            iframeRect={iframeRect}
            onFeedbackClick={handleFeedbackClick}
            onIframeRectChange={handleIframeRectChange}
            onFeedbackItemsChange={handleFeedbackItemsChange}
            onFeedbackToggle={toggleFeedbackMode}
            onEscape={handleEscape}
            onFeedbackConfirm={handleFeedbackConfirm}
            onFeedbackStatusChange={handleFeedbackStatusChange}
            onFeedbackDelete={handleFeedbackDelete}
            onBubbleOpen={handleFeedbackItemClick}
            onBubbleClose={handleBubbleClose}
          />
        </div>

        <div className="w-1/4 flex flex-col overflow-hidden">
          <InputPanel
            onSubmit={handlePromptSubmit}
            onSubmitFeedback={handleFeedbackSubmit}
            isStreaming={isStreaming}
            isFeedbackMode={isFeedbackMode}
            feedbackItems={feedbackItems}
            onFeedbackItemClick={handleFeedbackItemClick}
            textValue={promptText}
            onTextChange={setPromptText}
          />
          <VersionBar
            versions={versions}
            currentIndex={currentVersionIndex}
            onSelect={handleVersionSelect}
            onRestore={handleVersionRestore}
          />
        </div>
      </div>

      {error && (
        <div
          data-testid="error-state"
          className="fixed bottom-4 right-4 max-w-sm bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-start gap-3 shadow-lg z-50"
        >
          <span className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</span>
          <div className="flex gap-2 shrink-0">
            <button
              data-testid="retry-btn"
              onClick={handleRetry}
              className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
            >
              Retry
            </button>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-400 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
