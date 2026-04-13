#!/usr/bin/env bash
set -euo pipefail

CANVAS_CHAT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_AGENT_DEP_PATH="$(node -p "require('./package.json').dependencies['@mariozechner/pi-coding-agent']" 2>/dev/null)"

if [ -z "${PI_AGENT_DEP_PATH}" ] || [[ "${PI_AGENT_DEP_PATH}" != file:* ]]; then
  echo "  ✗ Could not resolve file dependency for @mariozechner/pi-coding-agent"
  exit 1
fi

PI_MONO_DIR="$(node -p "const path=require('node:path'); const dep=require('./package.json').dependencies['@mariozechner/pi-coding-agent']; path.resolve(process.cwd(), dep.replace(/^file:/, ''), '../..')" 2>/dev/null)"
PI_MONO_PARENT="$(dirname "${PI_MONO_DIR}")"
PI_MONO_GIT_URL="${PI_MONO_GIT_URL:-https://github.com/badlogic/pi-mono.git}"
PI_MONO_FALLBACK_URL="https://github.com/mariozechner/pi-mono.git"

clone_pi_mono() {
  local target_dir="$1"

  mkdir -p "${PI_MONO_PARENT}"

  if git clone "${PI_MONO_GIT_URL}" "${target_dir}"; then
    return 0
  fi

  if [ "${PI_MONO_GIT_URL}" != "${PI_MONO_FALLBACK_URL}" ]; then
    echo "  Primary clone failed, trying legacy repo URL..."
    git clone "${PI_MONO_FALLBACK_URL}" "${target_dir}"
    return $?
  fi

  return 1
}

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Canvas Chat — environment setup   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. pi-mono ────────────────────────────────────────────────────────────────
echo "▶ Step 1/5 — pi-mono"
echo "  Using pi-mono checkout at ${PI_MONO_DIR}"

if [ ! -d "${PI_MONO_DIR}/.git" ]; then
  echo "  Cloning pi-mono..."
  clone_pi_mono "${PI_MONO_DIR}"
else
  echo "  pi-mono already cloned — pulling latest"
  git -C "${PI_MONO_DIR}" pull --ff-only || echo "  (pull skipped — diverged or detached)"
fi

echo "  Building @mariozechner/pi-coding-agent..."
cd "${PI_MONO_DIR}/packages/coding-agent"
npm install --prefer-offline 2>&1 | tail -3
npm run build 2>&1 | tail -3
echo "  ✓ pi-coding-agent built"

# ── 2. canvas-chat dependencies ───────────────────────────────────────────────
echo ""
echo "▶ Step 2/5 — canvas-chat npm install"
cd "${CANVAS_CHAT_DIR}"
npm install --prefer-offline 2>&1 | tail -3
echo "  ✓ dependencies installed"

# ── 3. pi-coding-agent auth ───────────────────────────────────────────────────
echo ""
echo "▶ Step 3/5 — pi-coding-agent auth"

AUTH_DIR="${HOME}/.pi/agent"
AUTH_FILE="${AUTH_DIR}/auth.json"
mkdir -p "${AUTH_DIR}"

if [ -f "${AUTH_FILE}" ] && python3 -c "import json,sys; d=json.load(open('${AUTH_FILE}')); sys.exit(0 if d else 1)" 2>/dev/null; then
  echo "  ✓ auth.json already present"
else
  # Write empty placeholder so pi doesn't crash before login
  echo "{}" > "${AUTH_FILE}"
  chmod 600 "${AUTH_FILE}"
  echo "  ⚠ Not authenticated yet."
  echo "    After setup, run: pi"
  echo "    Then inside the TUI type: /login"
  echo "    Select 'openai-codex' and complete the OAuth flow."
fi

# ── 4. agent-browser + Chrome ─────────────────────────────────────────────────
echo ""
echo "▶ Step 4/5 — agent-browser"

if command -v agent-browser &> /dev/null; then
  echo "  agent-browser already installed — $(agent-browser --version 2>/dev/null || echo 'version unknown')"
else
  echo "  Installing agent-browser globally..."
  npm install -g agent-browser 2>&1 | tail -2
fi

echo "  Installing Chrome for Testing + system deps..."
if agent-browser install --with-deps 2>&1 | tail -5; then
  echo "  ✓ agent-browser ready"
else
  echo "  ⚠ agent-browser setup failed — continue manually if you need browser verification"
fi

# ── 5. Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "▶ Step 5/5 — verification"

cd "${CANVAS_CHAT_DIR}"

# Node version
NODE_VER=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "${NODE_VER}" | cut -d. -f1)
if [ "${NODE_MAJOR}" -ge 20 ]; then
  echo "  ✓ Node.js v${NODE_VER}"
else
  echo "  ✗ Node.js v${NODE_VER} is too old — need >= 20.6.0"
fi

# dist/cli.js
if [ -f "${CANVAS_CHAT_DIR}/node_modules/@mariozechner/pi-coding-agent/dist/cli.js" ]; then
  echo "  ✓ pi-coding-agent dist/cli.js present"
else
  echo "  ✗ pi-coding-agent dist/cli.js missing — build may have failed"
fi

# auth.json non-empty
if [ -f "${AUTH_FILE}" ] && python3 -c "import json,sys; d=json.load(open('${AUTH_FILE}')); sys.exit(0 if d else 1)" 2>/dev/null; then
  PROVIDERS=$(python3 -c "import json; d=json.load(open('${AUTH_FILE}')); print(', '.join(d.keys()) or 'none')" 2>/dev/null)
  echo "  ✓ pi auth — providers: ${PROVIDERS}"
else
  echo "  ⚠ pi not authenticated — run 'pi' then /login to complete OAuth"
fi

# typecheck + lint
echo "  Running npm run verify..."
if npm run verify 2>&1 | tail -4; then
  echo "  ✓ typecheck + lint passed"
else
  echo "  ✗ typecheck or lint failed — check output above"
fi

echo ""
echo "══════════════════════════════════════════"
echo "  Setup complete. Start dev server with:"
echo "    npm run dev"
echo "══════════════════════════════════════════"
echo ""
