'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { VersionEntry, FeedbackItem, SSEEvent } from '@/types';
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
} from '@/lib/feedback/htmlEncoder';

const MAX_VERSIONS = 20;

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentHtml, setCurrentHtml] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFeedbackMode, setIsFeedbackMode] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  // Stores the pending targetId for feedback confirm; not rendered so we use a ref.
  const activeFeedbackTargetRef = useRef<{ targetId: string } | null>(null);
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);
  const [iframeRect, setIframeRect] = useState<DOMRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');

  // Ref to the iframe element so we can access contentDocument for feedback ops
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Throttled HTML update during streaming
  const pendingHtmlRef = useRef('');
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPromptRef = useRef('');

  // Initialize session on mount
  useEffect(() => {
    fetch('/api/sessions', { method: 'POST' })
      .then((res) => res.json())
      .then((data: { sessionId: string }) => setSessionId(data.sessionId))
      .catch(() => setError('Failed to create session'));
  }, []);

  // Find iframe element in DOM for feedback operations
  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('[data-testid="canvas-iframe"]');
    iframeRef.current = iframe;
  });

  const handleIframeRectChange = useCallback((rect: DOMRect) => {
    setIframeRect(rect);
  }, []);

  const handleSubmit = useCallback(
    async (prompt: string) => {
      if (!sessionId || isStreaming) return;
      lastPromptRef.current = prompt;
      setIsStreaming(true);
      setError(null);
      pendingHtmlRef.current = '';

      // Start throttled interval to batch srcdoc updates
      streamIntervalRef.current = setInterval(() => {
        setCurrentHtml(pendingHtmlRef.current);
      }, 100);

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
              if (event.type === 'delta') {
                pendingHtmlRef.current += event.html;
              } else if (event.type === 'done') {
                if (streamIntervalRef.current) {
                  clearInterval(streamIntervalRef.current);
                  streamIntervalRef.current = null;
                }
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
                if (streamIntervalRef.current) {
                  clearInterval(streamIntervalRef.current);
                  streamIntervalRef.current = null;
                }
                setError(event.message);
                setIsStreaming(false);
              }
            } catch {
              // malformed SSE line — skip
            }
          }
        }
      } catch (err) {
        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming, currentHtml]
  );

  const handleRetry = useCallback(() => {
    if (lastPromptRef.current) {
      setError(null);
      handleSubmit(lastPromptRef.current);
    }
  }, [handleSubmit]);

  // Feedback mode: iframe click handler
  const handleFeedbackClick = useCallback(
    (targetId: string, rect: { top: number; left: number; width: number; height: number }) => {
      activeFeedbackTargetRef.current = { targetId };
      // Create a pending feedback item with empty text (bubble will let user type)
      const id = uuidv4();
      const pendingItem: FeedbackItem = {
        id,
        text: '',
        status: 'unresolved',
        timestamp: new Date().toISOString(),
        elementRect: rect as unknown as DOMRect,
      };
      setFeedbackItems((prev) => [...prev, pendingItem]);
      setActiveBubbleId(id);
    },
    []
  );

  // When user confirms feedback text in bubble
  const handleFeedbackConfirm = useCallback(
    (id: string, text: string) => {
      const item = feedbackItems.find((f) => f.id === id);
      if (!item) return;

      const iframe = iframeRef.current;
      const contentDoc = iframe?.contentDocument;
      if (!contentDoc) return;

      // Use the targetId stored in the ref when the bubble was opened
      const targetId = activeFeedbackTargetRef.current?.targetId ?? '';

      const wrapped = wrapElementWithFeedback(contentDoc, targetId, id, text);
      if (wrapped) {
        const newHtml = extractHtml(contentDoc);
        setCurrentHtml(newHtml);
      }

      setFeedbackItems((prev) =>
        prev.map((f) => (f.id === id ? { ...f, text } : f))
      );
      setActiveBubbleId(null);
    },
    [feedbackItems]
  );

  const handleFeedbackStatusChange = useCallback(
    (id: string, status: 'resolved' | 'unresolved') => {
      const iframe = iframeRef.current;
      const contentDoc = iframe?.contentDocument;
      if (contentDoc) {
        setFeedbackStatus(contentDoc, id, status);
        const newHtml = extractHtml(contentDoc);
        setCurrentHtml(newHtml);
      }
      setFeedbackItems((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status } : f))
      );
    },
    []
  );

  const handleFeedbackDelete = useCallback(
    (id: string) => {
      const iframe = iframeRef.current;
      const contentDoc = iframe?.contentDocument;
      if (contentDoc) {
        removeFeedback(contentDoc, id);
        const newHtml = extractHtml(contentDoc);
        setCurrentHtml(newHtml);
      }
      setFeedbackItems((prev) => prev.filter((f) => f.id !== id));
      if (activeBubbleId === id) setActiveBubbleId(null);
    },
    [activeBubbleId]
  );

  const handleFeedbackItemClick = useCallback((id: string) => {
    setActiveBubbleId(id);
  }, []);

  const handleBubbleClose = useCallback(() => {
    // If the bubble was for an unsaved item (empty text), remove it
    if (activeBubbleId) {
      const item = feedbackItems.find((f) => f.id === activeBubbleId);
      if (item && !item.text) {
        setFeedbackItems((prev) => prev.filter((f) => f.id !== activeBubbleId));
      }
    }
    setActiveBubbleId(null);
  }, [activeBubbleId, feedbackItems]);

  // Version navigation
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
    if (promptText.trim() && !isStreaming) {
      const text = promptText.trim();
      setPromptText('');
      handleSubmit(text);
    }
  }, [promptText, isStreaming, handleSubmit]);

  useKeyboard({
    onFeedbackToggle: () => setIsFeedbackMode((v) => !v),
    onSubmit: handleKeyboardSubmit,
    onEscape: handleEscape,
    onVersionPrev: handleVersionPrev,
    onVersionNext: handleVersionNext,
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <TopBar isFeedbackMode={isFeedbackMode} />

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas — 75% */}
        <div className="w-3/4 relative overflow-hidden border-r border-neutral-200 dark:border-neutral-800">
          <CanvasPanel
            html={currentHtml}
            isStreaming={isStreaming}
            isFeedbackMode={isFeedbackMode}
            feedbackItems={feedbackItems}
            activeBubbleId={activeBubbleId}
            iframeRect={iframeRect}
            onFeedbackClick={handleFeedbackClick}
            onHtmlChange={setCurrentHtml}
            onIframeRectChange={handleIframeRectChange}
            onFeedbackConfirm={handleFeedbackConfirm}
            onFeedbackStatusChange={handleFeedbackStatusChange}
            onFeedbackDelete={handleFeedbackDelete}
            onBubbleClose={handleBubbleClose}
          />
        </div>

        {/* Right panel — 25% */}
        <div className="w-1/4 flex flex-col overflow-hidden">
          <InputPanel
            onSubmit={handleSubmit}
            isStreaming={isStreaming}
            feedbackItems={feedbackItems}
            onFeedbackItemClick={handleFeedbackItemClick}
            onFeedbackStatusChange={handleFeedbackStatusChange}
            onFeedbackDelete={handleFeedbackDelete}
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
