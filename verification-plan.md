# Canvas Chat — Verification Plan

**Tool:** agent-browser (CLI, invoked via `child_process`)  
**Runner:** TypeScript scripts in `scripts/verify/`  
**Approach:** Phase-by-phase, each phase independently runnable, screenshots + snapshots + eval assertions

---

## How to Run

```bash
# Run all phases
npx tsx scripts/verify/run-all.ts

# Run a single phase
npx tsx scripts/verify/phase-1-shell.ts

# View screenshots
open scripts/verify/screenshots/
```

---

## Phase 1 — Shell & Layout

**Goal:** 75/25 split renders, shell chrome is neutral, panels are present.

| Step | Command | Assert |
|---|---|---|
| 1.1 | `open http://localhost:3000` | Page loads, title is "Canvas Chat" |
| 1.2 | `screenshot shell-initial.png` | Visual baseline |
| 1.3 | `snapshot` | Canvas panel and input panel exist in DOM |
| 1.4 | `eval "document.querySelector('.canvas-panel')?.getBoundingClientRect().width / window.innerWidth"` | Returns ~0.75 |
| 1.5 | `eval "document.querySelector('.input-panel')?.getBoundingClientRect().width / window.innerWidth"` | Returns ~0.25 |
| 1.6 | `is visible [data-testid=canvas-panel]` | True |
| 1.7 | `is visible [data-testid=input-panel]` | True |
| 1.8 | `is visible [data-testid=textarea]` | True |
| 1.9 | `is visible [data-testid=submit-btn]` | True |

---

## Phase 2 — Canvas: Empty & Loading States

**Goal:** Empty state shows placeholder; loading spinner appears immediately on submit.

| Step | Command | Assert |
|---|---|---|
| 2.1 | `snapshot` | Canvas shows empty/placeholder state |
| 2.2 | `screenshot canvas-empty.png` | Visual: neutral background, no content |
| 2.3 | `fill [data-testid=textarea] "Create a simple red button"` | Textarea has value |
| 2.4 | `eval "/* click submit then immediately snapshot */"` | (see note below) |
| 2.5 | `click [data-testid=submit-btn]` | Submits |
| 2.6 | `screenshot canvas-loading.png` (within 500ms) | Spinner visible |
| 2.7 | `wait [data-testid=loading-spinner] --timeout 500` | Spinner appeared |

> **Note:** Steps 2.5–2.7 require rapid sequencing. Use `batch` mode to fire click + screenshot in one invocation to capture the spinner before it disappears.

---

## Phase 3 — Canvas: Streaming Render

**Goal:** iframe `srcdoc` updates progressively; final render is complete HTML.

| Step | Command | Assert |
|---|---|---|
| 3.1 | (after Phase 2 submit) `wait --fn "document.querySelector('iframe')?.srcdoc?.length > 100" --timeout 10000` | HTML arriving in iframe |
| 3.2 | `screenshot canvas-streaming.png` | Partial render visible in iframe |
| 3.3 | `wait --fn "!document.querySelector('[data-testid=loading-spinner]')" --timeout 30000` | Spinner gone — stream complete |
| 3.4 | `screenshot canvas-final.png` | Full render |
| 3.5 | `eval "document.querySelector('iframe')?.srcdoc?.startsWith('<!DOCTYPE html') \|\| document.querySelector('iframe')?.srcdoc?.startsWith('<html')"` | True — complete HTML doc |
| 3.6 | `eval "document.querySelector('iframe')?.srcdoc?.length > 200"` | True |

---

## Phase 4 — Input Panel: Submit Controls

**Goal:** Button submit and Cmd+Enter both trigger generation; textarea clears or retains value per spec.

| Step | Command | Assert |
|---|---|---|
| 4.1 | `fill [data-testid=textarea] "Make the button blue"` | Textarea filled |
| 4.2 | `eval "document.querySelector('[data-testid=textarea]').value"` | Returns "Make the button blue" |
| 4.3 | `key [data-testid=textarea] Meta+Return` | Submits (Cmd+Enter) |
| 4.4 | `wait [data-testid=loading-spinner]` | Generation triggered |
| 4.5 | `wait --fn "!document.querySelector('[data-testid=loading-spinner]')" --timeout 30000` | Completes |
| 4.6 | `screenshot input-panel-post-submit.png` | Visual state after submit |

---

## Phase 5 — Feedback Mode: Activation

**Goal:** F key toggles feedback mode; badge appears; cursor changes to crosshair.

| Step | Command | Assert |
|---|---|---|
| 5.1 | `eval "document.body.dataset.feedbackMode \|\| 'off'"` | Returns "off" or falsy |
| 5.2 | `key body f` | Press F |
| 5.3 | `is visible [data-testid=feedback-badge]` | True — orange pill visible |
| 5.4 | `get text [data-testid=feedback-badge]` | Contains "Feedback Mode" |
| 5.5 | `screenshot feedback-mode-on.png` | Badge visible |
| 5.6 | `eval "document.body.dataset.feedbackMode"` | Returns "on" or truthy |
| 5.7 | `key body f` | Press F again to toggle off |
| 5.8 | `is visible [data-testid=feedback-badge]` | False — badge gone |
| 5.9 | `screenshot feedback-mode-off.png` | Badge absent |

---

## Phase 6 — Feedback Mode: Element Selection & Bubble

**Goal:** Clicking an element in feedback mode pins a bubble with textarea and Add button.

| Step | Command | Assert |
|---|---|---|
| 6.1 | `key body f` | Enable feedback mode |
| 6.2 | `eval "document.querySelector('iframe').contentDocument.querySelector('button')?.getBoundingClientRect()"` | Button exists in iframe |
| 6.3 | Click a rendered element inside iframe at known coordinates | (use `click` with pixel coords derived from eval) |
| 6.4 | `wait [data-testid=feedback-bubble]` | Bubble appeared |
| 6.5 | `is visible [data-testid=feedback-bubble]` | True |
| 6.6 | `is visible [data-testid=feedback-textarea]` | True |
| 6.7 | `is visible [data-testid=feedback-add-btn]` | True |
| 6.8 | `screenshot feedback-bubble-open.png` | Visual: bubble pinned to element |
| 6.9 | `fill [data-testid=feedback-textarea] "Make this button larger"` | Feedback text entered |
| 6.10 | `click [data-testid=feedback-add-btn]` | Confirm feedback |
| 6.11 | `wait [data-testid=feedback-dot]` | Pinned dot visible |
| 6.12 | `screenshot feedback-pinned.png` | Dot pinned on element |

---

## Phase 7 — Feedback Mode: HTML Encoding

**Goal:** Confirmed feedback wraps the element in `<user-feedback>` with correct attributes.

| Step | Command | Assert |
|---|---|---|
| 7.1 | (after Phase 6) `eval "document.querySelector('iframe').contentDocument.querySelector('user-feedback') !== null"` | True — element exists |
| 7.2 | `eval "document.querySelector('iframe').contentDocument.querySelector('user-feedback')?.dataset.status"` | Returns "unresolved" |
| 7.3 | `eval "document.querySelector('iframe').contentDocument.querySelector('user-feedback')?.dataset.feedbackId"` | Returns "fb-001" or similar |
| 7.4 | `eval "document.querySelector('iframe').contentDocument.querySelector('user-feedback')?.textContent?.includes('Make this button larger')"` | True |
| 7.5 | `eval "document.querySelector('iframe').contentDocument.querySelector('[data-feedback-target]') !== null"` | True — original element preserved inside wrapper |

---

## Phase 8 — Feedback Mode: Bubble Controls

**Goal:** Mark resolved / unresolved / delete / edit all work correctly.

| Step | Command | Assert |
|---|---|---|
| 8.1 | Click on pinned dot to re-open bubble | Bubble opens |
| 8.2 | `click [data-testid=feedback-resolve-btn]` | Mark resolved |
| 8.3 | `eval "document.querySelector('iframe').contentDocument.querySelector('user-feedback')?.dataset.status"` | Returns "resolved" |
| 8.4 | `click [data-testid=feedback-unresolve-btn]` | Mark unresolved |
| 8.5 | `eval "document.querySelector('iframe').contentDocument.querySelector('user-feedback')?.dataset.status"` | Returns "unresolved" |
| 8.6 | `click [data-testid=feedback-delete-btn]` | Delete |
| 8.7 | `eval "document.querySelector('iframe').contentDocument.querySelector('user-feedback')"` | Returns null — removed |

---

## Phase 9 — Feedback Panel (Summary List)

**Goal:** Feedback summary in input panel shows all open items with ID, text, status.

| Step | Command | Assert |
|---|---|---|
| 9.1 | (Add at least 2 feedback items via Phase 6 flow) | — |
| 9.2 | `is visible [data-testid=feedback-summary]` | True |
| 9.3 | `snapshot` | Shows feedback items in list |
| 9.4 | `eval "document.querySelectorAll('[data-testid=feedback-summary-item]').length"` | Returns 2 |
| 9.5 | `screenshot feedback-summary.png` | Summary list visible in input panel |
| 9.6 | `click [data-testid=feedback-summary-item]:first-child` | Scrolls/highlights element in canvas |

---

## Phase 10 — Agent Re-generation with Feedback

**Goal:** After submitting with feedback in iframe, agent resolves the annotated items.

| Step | Command | Assert |
|---|---|---|
| 10.1 | Add feedback item to canvas | `user-feedback[data-status=unresolved]` in iframe |
| 10.2 | `fill [data-testid=textarea] "Apply all the feedback"` | Prompt set |
| 10.3 | `click [data-testid=submit-btn]` | Submit |
| 10.4 | `wait --fn "!document.querySelector('[data-testid=loading-spinner]')" --timeout 30000` | Generation complete |
| 10.5 | `eval "document.querySelector('iframe').contentDocument.querySelector('user-feedback[data-status=resolved]') !== null"` | True — agent resolved feedback |
| 10.6 | `screenshot after-feedback-generation.png` | Canvas updated |

---

## Phase 11 — Version History: Save on Generation

**Goal:** Each completed generation creates a version entry; session folder contains HTML files.

| Step | Command | Assert |
|---|---|---|
| 11.1 | `eval "window.__versionHistory?.length"` | Returns ≥ 1 after first generation |
| 11.2 | Shell-side: `ls sessions/<chatId>/` | `v1.html` exists |
| 11.3 | After second generation: `eval "window.__versionHistory?.length"` | Returns ≥ 2 |
| 11.4 | Shell-side: `ls sessions/<chatId>/` | `v2.html` exists |

---

## Phase 12 — Version History: Switcher UI

**Goal:** Version switcher shows history; clicking loads read-only preview; Restore sets working canvas.

| Step | Command | Assert |
|---|---|---|
| 12.1 | `is visible [data-testid=version-bar]` | True |
| 12.2 | `snapshot` | Version entries visible (number, timestamp, prompt) |
| 12.3 | `screenshot version-bar.png` | Visual |
| 12.4 | `click [data-testid=version-item]:first-child` | Loads v1 into canvas (read-only) |
| 12.5 | `is visible [data-testid=restore-btn]` | True |
| 12.6 | `eval "window.__versionHistory?.length"` | History not destroyed — all versions present |
| 12.7 | `click [data-testid=restore-btn]` | Restore v1 as working canvas |
| 12.8 | `screenshot version-restored.png` | Canvas shows v1 content |

---

## Phase 13 — Version Navigation: Keyboard Shortcuts

**Goal:** Cmd+Z / Cmd+Shift+Z navigate version history.

| Step | Command | Assert |
|---|---|---|
| 13.1 | (on version 3 of 3) `key body Meta+z` | Canvas shows v2 |
| 13.2 | `screenshot version-prev.png` | V2 content visible |
| 13.3 | `key body Meta+z` | Canvas shows v1 |
| 13.4 | `key body Meta+Shift+z` | Canvas shows v2 again |
| 13.5 | `key body Meta+Shift+z` | Canvas shows v3 |

---

## Phase 14 — Keyboard Shortcuts: Escape

**Goal:** Esc closes open feedback bubble; second Esc exits feedback mode.

| Step | Command | Assert |
|---|---|---|
| 14.1 | Enable feedback mode + open bubble | Bubble visible |
| 14.2 | `key body Escape` | Bubble closes |
| 14.3 | `is visible [data-testid=feedback-bubble]` | False |
| 14.4 | `is visible [data-testid=feedback-badge]` | True — still in feedback mode |
| 14.5 | `key body Escape` | Exits feedback mode |
| 14.6 | `is visible [data-testid=feedback-badge]` | False |

---

## Phase 15 — Error States

**Goal:** Agent failures show correct error UI without corrupting canvas state.

| Step | Command | Assert |
|---|---|---|
| 15.1 | Simulate RPC failure (kill agent process mid-stream or use a bad prompt) | — |
| 15.2 | `wait [data-testid=error-state]` | Error state visible in canvas |
| 15.3 | `is visible [data-testid=retry-btn]` | True |
| 15.4 | `eval "document.querySelector('iframe')?.srcdoc"` | Unchanged from previous good state |
| 15.5 | `click [data-testid=retry-btn]` | Retries the prompt |

---

## File Structure

```
scripts/verify/
├── run-all.ts              # Orchestrator — runs all phases, aggregates results
├── utils.ts                # exec() wrapper, screenshot helper, assert helpers
├── phase-1-shell.ts
├── phase-2-canvas-loading.ts
├── phase-3-streaming.ts
├── phase-4-input.ts
├── phase-5-feedback-activation.ts
├── phase-6-feedback-bubble.ts
├── phase-7-feedback-encoding.ts
├── phase-8-feedback-controls.ts
├── phase-9-feedback-summary.ts
├── phase-10-feedback-round-trip.ts
├── phase-11-version-save.ts
├── phase-12-version-switcher.ts
├── phase-13-version-keyboard.ts
├── phase-14-keyboard-escape.ts
├── phase-15-error-states.ts
└── screenshots/            # Output screenshots from each phase
```

---

## Shared Utilities (`utils.ts`)

```typescript
import { execSync } from "child_process";

export function ab(args: string): string {
  return execSync(`agent-browser ${args}`, { encoding: "utf8" }).trim();
}

export function abJSON(args: string): any {
  return JSON.parse(ab(`${args} --json`));
}

export function screenshot(name: string) {
  ab(`screenshot scripts/verify/screenshots/${name}`);
}

export function assert(label: string, value: unknown, expected: unknown) {
  const ok = JSON.stringify(value) === JSON.stringify(expected);
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) throw new Error(`FAIL: ${label} — got ${value}, expected ${expected}`);
}

export function evalPage(js: string): any {
  return abJSON(`eval "${js.replace(/"/g, '\\"')}"`).data;
}
```

---

## Prerequisites

1. `npm install -g agent-browser && agent-browser install`
2. Canvas Chat dev server running: `npm run dev` (port 3000)
3. pi-coding-agent available in PATH
4. `npx tsx` available

---

## Notes

- **iframe interaction:** agent-browser's `snapshot` and `is visible` operate on the outer shell DOM. To inspect the iframe contents, use `eval` to reach into `document.querySelector('iframe').contentDocument`.
- **Batch mode:** Use `agent-browser batch` for rapid sequential steps (e.g., spinner capture) to avoid subprocess startup overhead.
- **test IDs:** All interactive elements in canvas-chat should carry `data-testid` attributes. These are the stable anchors for verification. Agree on the list before implementation starts.
- **Session folder checks** (Phase 11) run via Node.js `fs.existsSync`, not agent-browser.
