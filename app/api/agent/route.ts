import { writeFile } from 'fs/promises';
import path from 'path';
import { getOrCreateClient } from '@/lib/agent/clientCache';
import type { SSEEvent } from '@/types';
import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent';

export async function POST(request: Request) {
  const body = await request.json() as { sessionId: string; prompt: string; contextHtml?: string };
  const { sessionId, prompt, contextHtml } = body;

  if (!sessionId || !prompt) {
    return new Response(JSON.stringify({ error: 'sessionId and prompt are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fullPrompt = contextHtml
    ? `${prompt}\n\nCurrent canvas HTML:\n${contextHtml}`
    : prompt;

  const stream = new ReadableStream({
    start(controller) {
      function sendEvent(event: SSEEvent) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      }

      function close() {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      getOrCreateClient(sessionId)
        .then((entry) => {
          let htmlBuffer = '';

          const removeListener = entry.session.subscribe((event: AgentSessionEvent) => {
            if (event.type === 'message_update') {
              const ame = event.assistantMessageEvent;
              if (ame.type === 'text_delta' && ame.delta !== undefined) {
                const delta = ame.delta;
                htmlBuffer += delta;
                sendEvent({ type: 'delta', html: delta });
              }
            } else if (event.type === 'agent_end') {
              removeListener();
              entry.versionCount += 1;
              const n = entry.versionCount;
              const filePath = path.join(entry.cwd, `v${n}.html`);
              // Best-effort file write — non-fatal if it fails (e.g. disk full)
              writeFile(filePath, htmlBuffer, 'utf-8').catch(() => undefined);
              sendEvent({ type: 'done', version: n, html: htmlBuffer });
              close();
            }
          });

          return entry.session.prompt(fullPrompt).catch((err: unknown) => {
            removeListener();
            const message = err instanceof Error ? err.message : String(err);
            sendEvent({ type: 'error', message });
            close();
          });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          sendEvent({ type: 'error', message });
          close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
