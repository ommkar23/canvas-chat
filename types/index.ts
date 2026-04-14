export interface VersionEntry {
  version: number;
  timestamp: string;
  prompt: string;
  html: string;
}

export interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export interface FeedbackItem {
  id: string; // e.g. "fb-001"
  text: string;
  status: 'unresolved' | 'resolved';
  timestamp: string;
  elementRect: ElementRect | null; // anchor position for feedback dot/popup placement
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
    rect: ElementRect | null;
  };
  error: string | null;
}

export type SSEEvent =
  | { type: 'status'; message: string }
  | { type: 'done'; version: number; html: string }
  | { type: 'error'; message: string };
