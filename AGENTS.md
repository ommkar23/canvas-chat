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

The agent runs as a **local subprocess** via `RpcClient` from the published `@mariozechner/pi-coding-agent` npm package. A local `pi-mono` clone is optional and used only as source reference.

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

## Dev Container (recommended for Codespaces)

A ready-to-use dev container is included at `.devcontainer/`. It handles all
setup automatically — Node.js 24, pi-mono clone + build, npm install, and
Chrome install for agent-browser.

**Getting started in Codespaces:**

1. Open the repo in Codespaces — the container builds and `setup.sh` runs automatically.
2. Once setup finishes, authenticate pi:
   ```bash
   pi
   # Inside the TUI type: /login
   # Select "openai-codex" and complete the OAuth flow
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

Port 3000 is forwarded and opens in the browser automatically.

**Manual rebuild** (if you change `.devcontainer/`):
```bash
# In VS Code command palette:
# > Dev Containers: Rebuild Container
```

---

## Environment Setup (Cloud Shell / manual)

For Google Cloud Shell or any Debian/Ubuntu host where you can't use the dev container.
Follow the steps in order.

### Step 1 — Node.js ≥ 20.6.0

pi-coding-agent requires Node.js ≥ 20.6.0. Install via nvm (recommended) or the NodeSource apt repo.

```bash
# Option A: nvm (works in both Codespaces and Cloud Shell)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc        # or ~/.zshrc if using zsh
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version          # must be >= 20.6.0
npm --version
```

### Step 2 — Clone reference repos (optional, for source inspection)

The app installs `@mariozechner/pi-coding-agent` from npm. Local clones of `pi-mono`
and `agent-browser` are optional and useful when you want to inspect upstream source.
If you want those references beside the app, use this workspace layout:

```
<workspace>/
├── apps/
│   └── canvas-chat/   ← this repo (already cloned)
└── repos/
    ├── pi-mono/
    └── agent-browser/
```

```bash
# From the directory that contains apps/canvas-chat:
cd "$(dirname "$(pwd)")"      # go up to <workspace>/apps parent
mkdir -p repos
git clone https://github.com/badlogic/pi-mono.git repos/pi-mono
git clone https://github.com/vercel-labs/agent-browser.git repos/agent-browser
```

### Step 3 — Install app dependencies

```bash
cd apps/canvas-chat      # or wherever canvas-chat was cloned
npm install
```

This installs Next.js, React, uuid, and `@mariozechner/pi-coding-agent` from npm.

### Step 4 — Authenticate pi-coding-agent (Codex / OpenAI)

**Option A — Interactive login**

```bash
pi
# Inside the TUI, type: /login
# Select "openai-codex" and follow the OAuth flow
```

Credentials are stored at `~/.pi/agent/auth.json` and persist for the lifetime of the Codespace.

**Option B — API key (fallback)**

If you have an OpenAI API key, set it as an env var instead of OAuth:
```bash
export OPENAI_API_KEY=sk-...
# Add to ~/.bashrc to persist across sessions
echo 'export OPENAI_API_KEY=sk-...' >> ~/.bashrc
```

### Step 5 — Install agent-browser (for verification only)

Only needed if you want to run the 15-phase verification suite in `verification-plan.md`.

```bash
npm install -g agent-browser

# Download Chrome for Testing (one-time, ~150 MB)
agent-browser install

# Verify
agent-browser --version
```

### Step 6 — Install gh CLI (if not present)

GitHub Codespaces ships with `gh`. Google Cloud Shell does not.

```bash
# Cloud Shell only
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
  https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list
sudo apt-get update && sudo apt-get install gh -y
gh auth login
```

---

## Environment Verification

Run these checks to confirm the environment is ready before starting development.
All commands should exit 0 and print the expected output.

```bash
# 1. Node.js version — must be >= 20.6.0
node --version
# Expected: v20.x.x or v22.x.x or v24.x.x

# 2. npm available
npm --version
# Expected: 10.x.x or higher

# 3. pi-coding-agent CLI available (installed by npm install in canvas-chat)
./node_modules/.bin/pi --version 2>/dev/null || \
  node node_modules/@mariozechner/pi-coding-agent/dist/cli.js --version 2>/dev/null || \
  echo "MISSING — check Step 2 and 3"

# 4. pi auth credentials present
test -f ~/.pi/agent/auth.json && \
  python3 -c "import json; d=json.load(open('$HOME/.pi/agent/auth.json')); print('providers:', list(d.keys()))" || \
  echo "MISSING — follow Step 4"
# Expected: providers: ['openai-codex'] or ['openai'] or similar (non-empty)

# 5. pi-coding-agent dist/cli.js exists (needed by RpcClient)
test -f node_modules/@mariozechner/pi-coding-agent/dist/cli.js && \
  echo "OK — dist/cli.js found" || \
  echo "MISSING — run: npm install"

# 6. TypeScript and lint pass
npm run verify
# Expected: no errors

# 7. Dev server starts (ctrl+C to stop after confirming)
timeout 10 npm run dev 2>&1 | grep -E "Ready|error|Error" | head -3
# Expected: ✓ Ready in ...ms

# 8. Sessions API responds (run in a second terminal after dev server is up)
curl -s -X POST http://localhost:3000/api/sessions | python3 -m json.tool
# Expected: { "sessionId": "<uuid>" }

# 9. agent-browser available (only if running verification)
agent-browser --version 2>/dev/null || echo "NOT installed — see Step 5 (optional)"
```

A fully ready environment will pass all 9 checks (check 9 is optional).

---

## Hard rules

- Never call `RpcClient` from client components — it uses Node.js `child_process`
- Never add `localStorage` persistence in v1.0 — in-memory only by design
- Never change iframe `sandbox` attributes — `allow-scripts allow-same-origin` is required for overlay injection
- Never import `@mariozechner/pi-coding-agent` in client components — server-only
- Never remove `data-testid` attributes
