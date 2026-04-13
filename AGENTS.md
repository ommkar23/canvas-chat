<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Canvas Chat — Agent Guide

## What this project is

Canvas Chat is a developer-facing generative UI tool. A user describes UI in natural language; an AI agent (pi-coding-agent) streams back a complete, self-contained HTML document that renders live in a sandboxed iframe. Users annotate the rendered output with Figma-style feedback bubbles, which are encoded directly into the HTML as `<user-feedback>` elements and fed back to the agent on the next prompt.

PRD: `generative-ui-canvas-chat-prd.md`

---

## Architecture

```
Browser (React client components)
  ↕ SSE (text/event-stream)
app/api/agent/route.ts          ← owns RpcClient lifecycle
  ↕ stdio JSONL
pi-coding-agent subprocess      ← cwd = sessions/<chatId>/
  ↕ Codex API (pre-configured, no auth setup needed)
LLM
```

**One RpcClient per session.** Clients are cached in `lib/agent/clientCache.ts` in a module-level `Map`. This works in local dev mode (persistent Node.js process). Never instantiate `RpcClient` in React components or browser-side code.

---

## Key files

| Path | Purpose |
|---|---|
| `app/page.tsx` | Main shell — all UI state, SSE streaming loop, feedback ops, version navigation |
| `app/api/agent/route.ts` | POST — SSE stream from pi-coding-agent; writes `vN.html` to session dir |
| `app/api/sessions/route.ts` | POST — creates session UUID + folder under `sessions/` |
| `lib/agent/clientCache.ts` | Module-level RpcClient cache keyed by sessionId |
| `lib/agent/systemPrompt.ts` | HTML-generation system prompt injected via `--system-prompt` CLI arg |
| `lib/feedback/htmlEncoder.ts` | Wraps/unwraps iframe elements with `<user-feedback>` in the live DOM |
| `lib/feedback/overlayScript.ts` | Script injected into iframe `contentDocument` when feedback mode activates |
| `components/shell/CanvasPanel.tsx` | Sandboxed iframe + feedback overlay injection + bubble positioning |
| `types/index.ts` | Shared types: `VersionEntry`, `FeedbackItem`, `SSEEvent` |

---

## pi-coding-agent integration

The agent runs as a **local subprocess** via `RpcClient` from `@mariozechner/pi-coding-agent` (file-linked from `../../repos/pi-mono/packages/coding-agent`).

```typescript
import { RpcClient } from '@mariozechner/pi-coding-agent';

const client = new RpcClient({
  cliPath: '/abs/path/to/node_modules/@mariozechner/pi-coding-agent/dist/cli.js',
  cwd: '/abs/path/to/sessions/<chatId>',
  args: ['--system-prompt', SYSTEM_PROMPT],
});

await client.start();
await client.newSession();
await client.prompt(message);  // non-blocking — events fire via onEvent

client.onEvent((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
    accumulate(event.assistantMessageEvent.delta);  // streaming HTML chunks
  }
  if (event.type === 'agent_end') { /* finalize */ }
});
```

**Auth:** pre-configured with Codex login — no API keys or env vars needed.

**CLI path:** always absolute path to `dist/cli.js` inside `node_modules`. The default `"dist/cli.js"` is relative to `cwd` (session folder) and breaks.

---

## Feedback system

When feedback mode is active (`F` key):
1. `OVERLAY_SCRIPT` is injected into `iframe.contentDocument` — adds hover highlight + click listener
2. Click fires `postMessage` to parent with `{ type: '__feedback-click__', targetId, rect }`
3. Shell creates a `FeedbackItem` and shows `FeedbackBubble` popover
4. On confirm: `wrapElementWithFeedback()` wraps the live iframe DOM element in-place
5. `extractHtml(contentDoc)` reads the full document back and syncs to React state

`<user-feedback>` element format:
```html
<user-feedback data-feedback-id="fb-001" data-status="unresolved" data-timestamp="...">
  Make this button bigger
  <div data-feedback-target><!-- original element --></div>
</user-feedback>
```

The agent reads these on the next prompt (via `contextHtml`) and sets `data-status="resolved"` on items it addressed.

---

## Session folder layout

```
sessions/<uuid>/
├── v1.html    ← first completed generation
├── v2.html    ← second, etc.
```

`sessions/` is gitignored. The pi-coding-agent conversation JSONL is stored separately at `~/.pi/agent/sessions/`.

---

## data-testid inventory

All interactive elements carry `data-testid` for agent-browser verification. **Do not remove these.**

`top-bar` · `feedback-badge` · `canvas-panel` · `canvas-iframe` · `loading-spinner` · `input-panel` · `textarea` · `submit-btn` · `feedback-bubble` · `feedback-textarea` · `feedback-add-btn` · `feedback-dot` · `feedback-resolve-btn` · `feedback-unresolve-btn` · `feedback-delete-btn` · `feedback-summary` · `feedback-summary-item` · `version-bar` · `version-item` · `restore-btn` · `error-state` · `retry-btn`

---

## Keyboard shortcuts

`F` — feedback mode · `⌘↵` — submit · `Esc` — close bubble/exit mode · `⌘Z` — prev version · `⌘⇧Z` — next version

---

## Development

```bash
npm run dev       # Turbopack dev server on :3000
npm run verify    # tsc --noEmit && eslint
```

Run `npm run verify` after every non-trivial change.

---

## Hard rules

- Never call `RpcClient` from client components — it uses Node.js `child_process`
- Never add `localStorage` persistence in v1.0 — in-memory only by design
- Never change iframe `sandbox` attributes — `allow-scripts allow-same-origin` is required for overlay injection
- Never import `@mariozechner/pi-coding-agent` in client components — server-only
- Never remove `data-testid` attributes
