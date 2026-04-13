#!/usr/bin/env bash
set -euo pipefail

CANVAS_CHAT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="$(cd "${CANVAS_CHAT_DIR}/../.." && pwd)"
REFERENCE_REPOS_DIR="${WORKSPACE_ROOT}/repos"
PI_MONO_DIR="${REFERENCE_REPOS_DIR}/pi-mono"
AGENT_BROWSER_REF_DIR="${REFERENCE_REPOS_DIR}/agent-browser"
PI_MONO_GIT_URL="${PI_MONO_GIT_URL:-https://github.com/badlogic/pi-mono.git}"
AGENT_BROWSER_GIT_URL="${AGENT_BROWSER_GIT_URL:-https://github.com/vercel-labs/agent-browser.git}"
export PATH="${HOME}/.local/bin:${PATH}"

sync_reference_repo() {
  local name="$1"
  local git_url="$2"
  local target_dir="$3"

  mkdir -p "${REFERENCE_REPOS_DIR}"

  if [ ! -d "${target_dir}/.git" ]; then
    echo "  Cloning ${name} reference..."
    git clone "${git_url}" "${target_dir}"
  else
    echo "  ${name} reference already cloned — pulling latest"
    git -C "${target_dir}" pull --ff-only || echo "  (${name} pull skipped — diverged or detached)"
  fi
}

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Canvas Chat — environment setup   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. reference repos ────────────────────────────────────────────────────────
echo "▶ Step 1/5 — reference repos"
echo "  Reference repos live under ${REFERENCE_REPOS_DIR}"
sync_reference_repo "pi-mono" "${PI_MONO_GIT_URL}" "${PI_MONO_DIR}"
sync_reference_repo "agent-browser" "${AGENT_BROWSER_GIT_URL}" "${AGENT_BROWSER_REF_DIR}"
echo "  ✓ reference repos ready"

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

# ── 4. agent CLIs ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Step 4/6 — agent CLIs"

if command -v codex &> /dev/null; then
  echo "  codex already installed — $(codex --version 2>/dev/null || echo 'version unknown')"
else
  echo "  Installing Codex CLI..."
  npm install -g @openai/codex@latest 2>&1 | tail -3
fi

echo "  ✓ agent CLIs ready"

# ── 5. agent-browser + Chrome ─────────────────────────────────────────────────
echo ""
echo "▶ Step 5/6 — agent-browser"

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

# ── 6. Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "▶ Step 6/6 — verification"

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
  PI_AGENT_VERSION="$(node -p "require('./node_modules/@mariozechner/pi-coding-agent/package.json').version" 2>/dev/null || echo 'unknown')"
  echo "  ✓ pi-coding-agent dist/cli.js present (${PI_AGENT_VERSION})"
else
  echo "  ✗ pi-coding-agent dist/cli.js missing — npm install may have failed"
fi

# Agent CLIs
if command -v codex &> /dev/null; then
  echo "  ✓ codex — $(codex --version 2>/dev/null || echo 'version unknown')"
else
  echo "  ✗ codex missing"
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
