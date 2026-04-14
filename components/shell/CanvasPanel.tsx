'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { FeedbackItem } from '@/types';
import { FeedbackBubble } from '@/components/feedback/FeedbackBubble';
import { OVERLAY_SCRIPT, REMOVE_OVERLAY_SCRIPT } from '@/lib/feedback/overlayScript';
import { extractFeedbackItems } from '@/lib/feedback/htmlEncoder';

interface CanvasPanelProps {
  html: string;
  isStreaming: boolean;
  isFeedbackMode: boolean;
  feedbackItems: FeedbackItem[];
  activeBubbleId: string | null;
  iframeRect: DOMRect | null;
  onFeedbackClick: (targetId: string, rect: { top: number; left: number; width: number; height: number; bottom: number; right: number }) => void;
  onIframeRectChange: (rect: DOMRect) => void;
  onFeedbackItemsChange: (items: FeedbackItem[]) => void;
  onFeedbackToggle: () => void;
  onEscape: () => void;
  onFeedbackConfirm: (id: string, text: string) => void;
  onFeedbackStatusChange: (id: string, status: 'resolved' | 'unresolved') => void;
  onFeedbackDelete: (id: string) => void;
  onBubbleOpen: (id: string) => void;
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
  onFeedbackItemsChange,
  onFeedbackToggle,
  onEscape,
  onFeedbackConfirm,
  onFeedbackStatusChange,
  onFeedbackDelete,
  onBubbleOpen,
  onBubbleClose,
}: CanvasPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const feedbackModeRef = useRef(isFeedbackMode);
  const feedbackToggleRef = useRef(onFeedbackToggle);
  const escapeRef = useRef(onEscape);
  const hasContent = html.length > 0;

  useEffect(() => {
    feedbackModeRef.current = isFeedbackMode;
  }, [isFeedbackMode]);

  useEffect(() => {
    feedbackToggleRef.current = onFeedbackToggle;
  }, [onFeedbackToggle]);

  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  const syncFeedbackItems = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    onFeedbackItemsChange(extractFeedbackItems(doc));
  }, [onFeedbackItemsChange]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (iframe.srcdoc !== html) {
      iframe.srcdoc = html;
    }
  }, [html]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function injectScript(code: string) {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const script = doc.createElement('script');
      script.textContent = code;
      doc.body?.appendChild(script);
      doc.body?.removeChild(script);
    }

    function handleIframeKeyDown(e: KeyboardEvent) {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        feedbackToggleRef.current();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        escapeRef.current();
      }
    }

    function attachIframeKeyListener() {
      iframeRef.current?.contentWindow?.removeEventListener('keydown', handleIframeKeyDown);
      iframeRef.current?.contentWindow?.addEventListener('keydown', handleIframeKeyDown);
    }

    function onLoad() {
      syncFeedbackItems();
      attachIframeKeyListener();
      if (feedbackModeRef.current) {
        injectScript(OVERLAY_SCRIPT);
      } else {
        injectScript(REMOVE_OVERLAY_SCRIPT);
      }
    }

    iframe.addEventListener('load', onLoad);

    attachIframeKeyListener();
    if (isFeedbackMode) {
      injectScript(OVERLAY_SCRIPT);
    } else {
      injectScript(REMOVE_OVERLAY_SCRIPT);
    }
    syncFeedbackItems();

    return () => {
      iframe.removeEventListener('load', onLoad);
      iframe.contentWindow?.removeEventListener('keydown', handleIframeKeyDown);
    };
  }, [isFeedbackMode, syncFeedbackItems]);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === '__feedback-click__') {
        const { targetId, rect } = e.data as {
          targetId: string;
          rect: { top: number; left: number; width: number; height: number; bottom: number; right: number };
        };
        onFeedbackClick(targetId, rect);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onFeedbackClick]);

  const updateIframeRect = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      onIframeRectChange(iframe.getBoundingClientRect());
      syncFeedbackItems();
    }
  }, [onIframeRectChange, syncFeedbackItems]);

  useEffect(() => {
    updateIframeRect();
    window.addEventListener('resize', updateIframeRect);
    return () => window.removeEventListener('resize', updateIframeRect);
  }, [updateIframeRect]);

  return (
    <div data-testid="canvas-panel" className="relative w-full h-full">
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

      {isFeedbackMode &&
        feedbackItems.map((item) => (
          <FeedbackBubble
            key={item.id}
            item={item}
            iframeRect={iframeRect}
            isOpen={activeBubbleId === item.id}
            onOpen={onBubbleOpen}
            onConfirm={onFeedbackConfirm}
            onStatusChange={onFeedbackStatusChange}
            onDelete={onFeedbackDelete}
            onClose={onBubbleClose}
          />
        ))}
    </div>
  );
}
