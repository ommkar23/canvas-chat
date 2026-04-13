export interface VersionEntry {
  version: number;
  timestamp: string;
  prompt: string;
  html: string;
}

export interface FeedbackItem {
  id: string; // e.g. "fb-001"
  text: string;
  status: 'unresolved' | 'resolved';
  timestamp: string;
  elementRect: DOMRect | null; // position in iframe for bubble placement
}

export interface AppState {
  sessionId: string | null;
  currentHtml: string;
  isStreaming: boolean;
  isFeedbackMode: boolean;
  versions: VersionEntry[];
  currentVersionIndex: number; // index into versions[] — -1 means latest
  feedbackItems: FeedbackItem[];
  activeBubble: {
    feedbackId: string | null;
    rect: { top: number; left: number; width: number; height: number } | null;
  };
  error: string | null;
}

export type SSEEvent =
  | { type: 'delta'; html: string }
  | { type: 'done'; version: number; html: string }
  | { type: 'error'; message: string };
