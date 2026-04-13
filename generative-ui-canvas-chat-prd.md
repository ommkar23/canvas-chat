# Generative UI Canvas Chat — Product Requirements Document

**Product Name:** Canvas Chat  
**Version:** 1.0  
**Author:** Ommkar Pattnaik  
**Date:** April 2026  
**Status:** Draft

---

## 1. Overview

Canvas Chat is a developer-facing generative UI tool that pairs a live HTML canvas with a conversational agent input panel. The user describes UI they want to build; the agent generates raw HTML which is immediately rendered in the canvas. The tool includes a first-class feedback annotation layer — modelled after Figma's comment system — that lets users mark up individual rendered elements, collect feedback in the HTML itself, and submit the annotated HTML back to the agent for iterative refinement.

The system is designed to collapse the loop between intent, generation, visual review, and revision into a single cohesive surface.

---

## 2. Goals & Non-Goals

### Goals

- Enable rapid iterative HTML UI generation via a locally-running coding agent (pi-coding-agent via RPC)
- Provide a real-time visual canvas that streams and renders agent-produced HTML
- Support structured in-canvas feedback using a Figma-inspired annotation layer
- Encode feedback directly into the generated HTML so the agent can read and act on it
- Maintain a version history allowing users to revert to any prior canvas state

### Non-Goals (v1.0)

- Multi-modal input (image upload, file attachments) — text only
- Collaborative / multi-user annotations
- Deployment or export of the generated HTML to external hosting
- Agent generating CSS/JS separately — only complete self-contained HTML documents
- Mobile responsiveness of the Canvas Chat shell itself (desktop-first)

---

## 3. User

**Primary user:** Ommkar (and others with a similar builder/developer profile) — technically sophisticated, building AI-native products, comfortable with developer tooling, needs a tight feedback loop between generation and visual iteration.

**Mental model:** The user thinks of this tool like a "live design scratchpad" connected to an AI coder. The right panel is their keyboard; the left panel is their whiteboard.

---

## 4. Layout & Shell

### 4.1 Split Layout

```
┌───────────────────────────────────┬────────────────┐
│                                   │                │
│         CANVAS (75%)              │  INPUT PANEL   │
│                                   │     (25%)      │
│     [ iframe renders here ]       │                │
│                                   │  ┌──────────┐ │
│                                   │  │ textarea │ │
│                                   │  └──────────┘ │
│                                   │  [ Submit ]    │
└───────────────────────────────────┴────────────────┘
```

- **Canvas Panel (75% width, left):** Hosts the sandboxed `<iframe>` that renders agent-produced HTML. All canvas states (empty, loading, streaming, rendered, feedback mode) display here.
- **Input Panel (25% width, right):** Contains only user-facing elements — a text input area and submission controls. **No agent output is displayed here.** Agent responses are purely visual, rendered into the canvas.

### 4.2 Shell Aesthetic

The outer shell (chrome, panel backgrounds, borders, toolbar) adopts a **neutral, minimal aesthetic** — dark or light depending on system preference. The shell deliberately stays out of the way, as the canvas content is the primary visual element and may define its own design system.

The shell should not impose any visual style on the canvas content. The iframe is isolated.

---

## 5. Canvas Rendering

### 5.1 iframe Sandbox

The canvas renders inside a sandboxed `<iframe srcdoc="...">`. This provides:
- Script isolation (agent-generated JS cannot access the host shell)
- Style isolation (agent CSS does not bleed into the shell)
- A clean, controllable rendering environment

**Sandbox attributes:** `allow-scripts allow-same-origin` — scripts enabled so agent-generated interactivity works; same-origin enabled to allow the shell to inject the feedback overlay layer into the iframe DOM.

### 5.2 Loading State

When a prompt is submitted and the agent begins generating:

1. Canvas shows a **centered loading spinner** on a neutral background
2. As the first streamed HTML tokens arrive, the spinner is replaced
3. Canvas begins **progressively rendering the streaming HTML** — the iframe `srcdoc` is updated incrementally as chunks arrive
4. Final render state is reached when the agent stream closes

### 5.3 Streaming Render

The shell listens to the RPC stream from pi-coding-agent. As HTML chunks arrive:
- The shell accumulates the partial HTML string in memory
- The iframe `srcdoc` is updated at a capped interval (e.g., every 100ms or every N tokens) to avoid thrashing
- The canvas visually "builds" in real time — elements appear as they are streamed

### 5.4 Completed State

Once the stream closes, the final HTML is stored as a new version entry (see Section 8: Version History). The canvas displays the complete rendered output.

---

## 6. Input Panel

### 6.1 Scope

- **Text-only** in v1.0
- A resizable `<textarea>` for prompt input
- Submit via button click or `Cmd/Ctrl + Enter`
- No attachment support, no structured options, no agent response display

### 6.2 Context Passed to Agent

On each submission, the shell sends to the agent:
1. The user's text prompt
2. The **current full HTML content of the iframe** (including any embedded `<user-feedback>` components from the feedback layer)

This gives the agent both the user's intent and the full annotated visual context in a single RPC call.

---

## 7. Feedback Mode

### 7.1 Activation

- Press **`F`** to toggle feedback mode ON/OFF
- A persistent **"Feedback Mode" badge** appears in the top bar of the canvas panel while active (e.g., an orange pill: `● Feedback Mode`)
- Cursor changes to a crosshair inside the canvas to signal the mode

### 7.2 Element Selection

- In feedback mode, hovering over any visible element in the canvas highlights it with a **1px accent-color border and a subtle background tint**
- Clicking an element selects it — the selection targets **whichever element is visually under the cursor** (no DOM tree walking, no parent/child disambiguation controls in v1.0)
- Both parent containers and leaf elements are equally selectable based on what is visually on top

### 7.3 Feedback Bubble (Figma-Style)

On click, a **feedback bubble** appears:

```
  ● ──────────────────────────────────────┐
      [ Feedback text input               ]
      [ e.g. "Make this button bigger"    ]
                              [ Add ]
  └────────────────────────────────────────┘
```

- A small **pinned dot** anchors to the top-left corner of the selected element
- A **popover card** opens adjacent to the dot, containing a textarea and an "Add" button
- Multiple bubbles can exist simultaneously on different elements
- Bubbles are non-blocking — the user can click other elements and add more feedback before submitting

### 7.4 Feedback Encoding (in HTML)

When the user confirms a feedback entry, the shell:

1. Locates the target element in the iframe DOM
2. Wraps it (or annotates it in-place) with a `<user-feedback>` custom HTML element
3. Sets the feedback text as the content of the `<user-feedback>` element
4. Assigns a unique `data-feedback-id` attribute for tracking

**HTML encoding format:**

```html
<user-feedback
  data-feedback-id="fb-001"
  data-status="unresolved"
  data-timestamp="2026-04-13T14:15:00Z"
>
  Make this button bigger and change the color to match the brand
  <div data-feedback-target>
    <!-- original element lives here -->
    <button class="cta-button">Get Started</button>
  </div>
</user-feedback>
```

- `class="user-feedback"` is also added for CSS targeting
- `data-status` can be: `unresolved` | `resolved`
- The original element is preserved inside the `<user-feedback>` wrapper

### 7.5 Feedback Lifecycle

| State | Who sets it | What it means |
|---|---|---|
| `unresolved` | User (on creation) | Feedback added, not yet acted on |
| `resolved` | Agent (after re-generation) | Agent applied the change |
| `unresolved` (re-opened) | User | User is not satisfied, re-opens for another round |

**User controls on each bubble:**
- **Mark resolved** — manually close a bubble
- **Mark unresolved** — re-open a resolved bubble (agent didn't satisfy the feedback)
- **Delete** — remove the feedback entirely
- **Edit** — modify the feedback text before submission

When the agent re-renders the canvas after a feedback-informed prompt, it produces new HTML. The shell diffs resolved feedback items — if the agent included `data-status="resolved"` on a `<user-feedback>` element, the bubble closes. Unresolved items persist with their status intact.

### 7.6 Feedback Panel (Summary)

A collapsible **Feedback Summary** list in the input panel's upper section shows all open feedback items:
- Feedback ID, short truncated text
- Status badge (unresolved / resolved)
- Click to jump-to / highlight the element in the canvas

This is visible in both normal mode and feedback mode.

---

## 8. Version History

### 8.1 Storage

Each time the agent completes a stream and the canvas reaches a final render state, the complete HTML is stored as a version entry in memory (no localStorage in v1.0):

```json
{
  "version": 3,
  "timestamp": "2026-04-13T14:22:00Z",
  "prompt": "Make the hero section full width",
  "html": "<!DOCTYPE html>..."
}
```

### 8.2 Version Switcher

A **version timeline** is accessible from the input panel (e.g., a compact horizontal strip or a dropdown):
- Shows version number, timestamp, and truncated prompt
- Clicking any version loads that HTML into the canvas (read-only preview)
- A **"Restore this version"** button sets it as the current working canvas
- Restoring a version does not delete newer versions — the history is preserved

### 8.3 Limits

In v1.0, the last **20 versions** are retained in memory. Older versions are evicted (FIFO).

---

## 9. Agent Integration (pi-coding-agent RPC)

### 9.1 Communication Protocol

pi-coding-agent runs as a **local subprocess** communicating over **stdio using newline-delimited JSON (JSONL)**. There is no HTTP server — canvas-chat spawns it as a child process via the `RpcClient` TypeScript SDK from the `@mariozechner/pi-coding-agent` package (located in `pi-mono/packages/coding-agent`).

**Transport:** stdin/stdout JSONL. Each message is one JSON object per line. LF (`\n`) is the only valid delimiter.

**Architecture:**
```
Browser (React)
  ↕ HTTP / SSE
Next.js API route (/api/agent/...)
  ↕ RpcClient (stdio JSONL)
pi subprocess  (cwd = sessions/<chatId>/)
  ↕ API
Claude / LLM
```

The Next.js API route owns the `RpcClient` lifecycle. It proxies the agent's streaming events to the browser as **Server-Sent Events (SSE)**.

### 9.2 RpcClient SDK Usage

```typescript
import { RpcClient } from "@mariozechner/pi-coding-agent";

const client = new RpcClient({
  cwd: `/path/to/sessions/${chatId}`,   // per-chat working directory
  provider: "anthropic",
  model: "claude-sonnet-4-20250514"
});

await client.start();
await client.prompt(userMessage);       // non-blocking; events fire via onEvent

client.onEvent((event) => {
  if (event.type === "message_update"
      && event.assistantMessageEvent.type === "text_delta") {
    streamToFrontend(event.assistantMessageEvent.delta);  // HTML chunks
  }
  if (event.type === "agent_end") {
    finalizeAndSaveVersion();
  }
});

await client.stop();
```

**Key RpcClient methods:**

| Method | Description |
|---|---|
| `start()` / `stop()` | Spawn / kill subprocess |
| `prompt(message)` | Send user message; streams events |
| `steer(message)` | Interrupt mid-stream with new instruction |
| `followUp(message)` | Queue message after current turn ends |
| `newSession()` | Reset conversation context |
| `getState()` | Returns session ID, file path, model, streaming flag |
| `setModel(provider, modelId)` | Hot-swap LLM |
| `onEvent(listener)` | Subscribe to all streaming events |

### 9.3 Streaming Event Flow

Events arrive in this order for each prompt:

```
agent_start → turn_start → message_start
  → message_update { type: "text_delta", delta: "<html>..." }   ← accumulate HTML
  → message_update { type: "text_delta", delta: "<head>..." }
  → ...
→ message_end → turn_end → agent_end { messages: [...] }
```

Relevant event subtypes on `message_update.assistantMessageEvent`:
- `text_delta` — streamed text (HTML content arrives here)
- `toolcall_start/delta/end` — if agent invokes tools
- `thinking_delta` — extended thinking tokens (if enabled)

The shell accumulates `text_delta` values into a buffer and updates the iframe `srcdoc` at a capped interval (~100ms) to avoid thrashing.

### 9.4 Per-Session Folder Strategy

For each new chat, canvas-chat:
1. Generates a `chatId` (UUID)
2. Creates a session directory: `sessions/<chatId>/`
3. Spawns `RpcClient` with `cwd` set to that directory
4. Saves each completed HTML generation as `v1.html`, `v2.html`, etc. in that folder

The agent's conversation JSONL is stored separately by pi at `~/.pi/agent/sessions/--<cwd-path>--/<timestamp>.jsonl`.

**Authentication:** pi-coding-agent is pre-configured with Codex login — no additional auth setup required in canvas-chat.

### 9.5 Agent Contract

**Input sent to agent (prompt text):**
```
<user's text input>

Current canvas HTML:
<full current iframe HTML including <user-feedback> elements>
```

**Expected agent output:**
- A stream of `text_delta` events forming a **complete, self-contained HTML document**
- The agent must output only HTML — no markdown code fences, no prose
- The agent reads `<user-feedback>` elements and applies changes accordingly
- After applying feedback, agent sets `data-status="resolved"` on addressed elements

### 9.6 System Prompt

Injected via `buildSystemPrompt({ customPrompt: "..." })` or by placing `AGENTS.md` / `SYSTEM.md` in the session cwd.

> You are an HTML generation agent. Your sole output is a complete, self-contained HTML document — including all CSS and JavaScript inline. Do not output markdown, prose, or code fences. When the input HTML contains `<user-feedback>` elements, read the feedback text, apply the requested changes to the wrapped element, and set `data-status="resolved"` on those elements in your output HTML. Preserve all `<user-feedback>` elements in your output unless the user's prompt explicitly asks to remove them.

### 9.7 Error Handling

- If the RPC subprocess fails or times out: canvas shows an inline error state with a "Retry" button; no canvas state change
- If `agent_end` fires with no valid HTML accumulated: canvas displays an error state prompting the user to refine their prompt
- If `text_delta` stream produces malformed HTML: the shell renders best-effort and shows a warning toast
- Steer / abort: user can cancel a running generation via `client.steer()` or `client.abort()` mid-stream

---

## 10. Keyboard Shortcuts

| Key | Action |
|---|---|
| `F` | Toggle feedback mode on/off |
| `Cmd/Ctrl + Enter` | Submit prompt |
| `Escape` | Close open feedback bubble / exit feedback mode |
| `Cmd/Ctrl + Z` | Revert to previous version |
| `Cmd/Ctrl + Shift + Z` | Advance to next version |

---

## 11. Component Architecture

```
canvas-chat/
├── shell/
│   ├── CanvasPanel.tsx         # iframe wrapper, loading/streaming state
│   ├── InputPanel.tsx          # textarea, submit, feedback summary list
│   ├── VersionBar.tsx          # version timeline/switcher
│   └── TopBar.tsx              # mode badge, shortcuts hint
├── feedback/
│   ├── FeedbackOverlay.tsx     # injected into iframe DOM
│   ├── FeedbackBubble.tsx      # pinned dot + popover card
│   ├── FeedbackStore.ts        # in-memory store for feedback state
│   └── htmlEncoder.ts          # wraps elements with <user-feedback>
├── agent/
│   ├── rpcClient.ts            # pi-coding-agent RPC stream handler
│   └── streamingRenderer.ts    # iframe srcdoc update throttle loop
└── store/
    └── versionHistory.ts       # in-memory version ring buffer (20 items)
```

---

## 12. Open Questions & Future Scope

| Topic | Note |
|---|---|
| Feedback overlay injection | The shell must inject a `<script>` into the iframe for hover/click detection. This requires careful handling to not interfere with agent-generated scripts |
| Z-index management | Feedback bubbles must always render above agent HTML regardless of what z-index values the agent uses |
| Feedback on dynamically rendered elements | Agent HTML may include JS that replaces DOM nodes; feedback anchored to replaced nodes will need re-anchoring logic in v2 |
| Image/file input | Deferred to v2 |
| Export / publish | Deferred to v2 |
| Collaborative annotations | Deferred to v3 |
| Agent model selection | The agent is pi-coding-agent in v1; a model switcher could be added later |

---

## 13. Success Metrics (v1.0)

- **Time-to-render:** First streamed pixel appears within 2s of prompt submission
- **Feedback round-trip:** Agent correctly resolves ≥80% of annotated feedback items in the next generation
- **Version fidelity:** Any prior version can be restored to an identical canvas render
- **Feedback persistence:** `<user-feedback>` elements survive agent re-generation without data loss

