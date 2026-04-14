import { copyFile, readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';
import { getOrCreateClient } from '@/lib/agent/clientCache';
import type { SSEEvent } from '@/types';

function versionPrompt(targetFile: string, prompt: string, hasFeedback: boolean, isFirstVersion: boolean) {
  if (isFirstVersion) {
    return [
      `Create a new complete, self-contained HTML document in ${targetFile}.`,
      'Use the available file tools to create the file in the working directory.',
      `User request: ${prompt}`,
    ].join('\n');
  }

  return [
    `Edit ${targetFile} in place using the available file tools.`,
    'Preserve it as a complete, self-contained HTML document with inline CSS and JavaScript.',
    hasFeedback
      ? 'The file already contains embedded <user-feedback> elements. Incorporate the requested changes, update addressed feedback to data-status="resolved", and keep unresolved feedback in the file.'
      : 'Incorporate the user\'s requested changes into the existing file.',
    `User request: ${prompt}`,
  ].join('\n');
}

async function getLatestVersionNumber(cwd: string): Promise<number> {
  const entries = await readdir(cwd, { withFileTypes: true });
  const versions = entries
    .filter((entry) => entry.isFile())
    .map((entry) => /^v(\d+)\.html$/.exec(entry.name)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number.parseInt(value, 10));

  return versions.length > 0 ? Math.max(...versions) : 0;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId: string; prompt: string; contextHtml?: string };
  const { sessionId, prompt, contextHtml } = body;

  if (!sessionId || !prompt) {
    return new Response(JSON.stringify({ error: 'sessionId and prompt are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

      (async () => {
        try {
          const entry = await getOrCreateClient(sessionId);
          const latestVersion = await getLatestVersionNumber(entry.cwd);
          const nextVersion = latestVersion + 1;
          const targetFile = `v${nextVersion}.html`;
          const targetPath = path.join(entry.cwd, targetFile);
          const latestPath = latestVersion > 0 ? path.join(entry.cwd, `v${latestVersion}.html`) : null;
          const hasFeedback = (contextHtml ?? '').includes('<user-feedback');
          const isFirstVersion = latestVersion === 0;

          if (isFirstVersion) {
            sendEvent({ type: 'status', message: `Creating ${targetFile}` });
          } else if (contextHtml?.trim()) {
            sendEvent({ type: 'status', message: `Preparing ${targetFile} from current canvas` });
            await writeFile(targetPath, contextHtml, 'utf-8');
          } else if (latestPath) {
            sendEvent({ type: 'status', message: `Copying v${latestVersion}.html to ${targetFile}` });
            await copyFile(latestPath, targetPath);
          }

          const fullPrompt = versionPrompt(targetFile, prompt, hasFeedback, isFirstVersion);
          sendEvent({ type: 'status', message: `Asking agent to update ${targetFile}` });
          await entry.session.prompt(fullPrompt);

          const finalHtml = await readFile(targetPath, 'utf-8');
          entry.versionCount = Math.max(entry.versionCount, nextVersion);
          sendEvent({ type: 'done', version: nextVersion, html: finalHtml });
          close();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          sendEvent({ type: 'error', message });
          close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
