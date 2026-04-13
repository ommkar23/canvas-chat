'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { FeedbackItem } from '@/types';
import { FeedbackBubble } from '@/components/feedback/FeedbackBubble';
import { OVERLAY_SCRIPT, REMOVE_OVERLAY_SCRIPT } from '@/lib/feedback/overlayScript';

interface CanvasPanelProps {
  html: string;
  isStreaming: boolean;
  isFeedbackMode: boolean;
  feedbackItems: FeedbackItem[];
  activeBubbleId: string | null;
  iframeRect: DOMRect | null;
  onFeedbackClick: (targetId: string, rect: { top: number; left: number; width: number; height: number }) => void;
  onHtmlChange: (html: string) => void;
  onIframeRectChange: (rect: DOMRect) => void;
  onFeedbackConfirm: (id: string, text: string) => void;
  onFeedbackStatusChange: (id: string, status: 'resolved' | 'unresolved') => void;
  onFeedbackDelete: (id: string) => void;
  onBubbleClose: () => void;
}

export function CanvasPanel({
  html,
  isStreaming,
  isFeedbackMode,
  feedbackItems,
  activeBubbleId,
  iframeRect,
  onFeedbackClick,
  onIframeRectChange,
  onFeedbackConfirm,
  onFeedbackStatusChange,
  onFeedbackDelete,
  onBubbleClose,
}: CanvasPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const feedbackModeRef = useRef(isFeedbackMode);
  // Derived from html prop — no state needed
  const hasContent = html.length > 0;

  // Keep feedbackModeRef in sync
  useEffect(() => {
    feedbackModeRef.current = isFeedbackMode;
  }, [isFeedbackMode]);

  // Update srcdoc directly to avoid full iframe reload during streaming
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (iframe.srcdoc !== html) {
      iframe.srcdoc = html;
    }
  }, [html]);

  // Inject/remove overlay script when feedback mode changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function injectScript(code: string) {
      const doc = iframe!.contentDocument;
      if (!doc) return;
      const script = doc.createElement('script');
      script.textContent = code;
      doc.body?.appendChild(script);
      doc.body?.removeChild(script);
    }

    function onLoad() {
      if (feedbackModeRef.current) {
        injectScript(OVERLAY_SCRIPT);
      }
    }

    iframe.addEventListener('load', onLoad);

    // Also inject immediately if iframe is already loaded
    if (isFeedbackMode) {
      injectScript(OVERLAY_SCRIPT);
    } else {
      injectScript(REMOVE_OVERLAY_SCRIPT);
    }

    return () => {
      iframe.removeEventListener('load', onLoad);
    };
  }, [isFeedbackMode]);

  // Listen for postMessage from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === '__feedback-click__') {
        const { targetId, rect } = e.data as {
          targetId: string;
          rect: { top: number; left: number; width: number; height: number };
        };
        onFeedbackClick(targetId, rect);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onFeedbackClick]);

  // Update iframeRect on mount and resize
  const updateIframeRect = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      onIframeRectChange(iframe.getBoundingClientRect());
    }
  }, [onIframeRectChange]);

  useEffect(() => {
    updateIframeRect();
    window.addEventListener('resize', updateIframeRect);
    return () => window.removeEventListener('resize', updateIframeRect);
  }, [updateIframeRect]);

  const activeFeedbackItem = activeBubbleId
    ? feedbackItems.find((f) => f.id === activeBubbleId) ?? null
    : null;

  return (
    <div data-testid="canvas-panel" className="relative w-full h-full">
      {/* Loading spinner — shown at start of streaming before content arrives */}
      {isStreaming && !hasContent && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 z-10">
          <div
            data-testid="loading-spinner"
            className="w-8 h-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-orange-500 rounded-full animate-spin"
          />
        </div>
      )}

      <iframe
        ref={iframeRef}
        data-testid="canvas-iframe"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={html}
        className="w-full h-full border-0"
        title="Canvas"
      />

      {/* Active feedback bubble */}
      {activeFeedbackItem && (
        <FeedbackBubble
          item={activeFeedbackItem}
          iframeRect={iframeRect}
          onConfirm={onFeedbackConfirm}
          onStatusChange={onFeedbackStatusChange}
          onDelete={onFeedbackDelete}
          onClose={onBubbleClose}
        />
      )}
    </div>
  );
}
