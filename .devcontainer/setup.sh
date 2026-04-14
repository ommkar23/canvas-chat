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

# ── 2. pi-coding-agent auth ───────────────────────────────────────────────────
echo ""
echo "▶ Step 2/4 — pi-coding-agent auth"

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

# ── 3. agent CLIs ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Step 3/4 — agent CLIs"

if command -v codex &> /dev/null; then
  echo "  codex already installed — $(codex --version 2>/dev/null || echo 'version unknown')"
else
  echo "  Installing Codex CLI..."
  npm install -g @openai/codex@latest 2>&1 | tail -3
fi

echo "  ✓ agent CLIs ready"

# ── 4. agent-browser + Chrome ─────────────────────────────────────────────────
echo ""
echo "▶ Step 4/4 — agent-browser"

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

echo ""
echo "══════════════════════════════════════════"
echo "  Setup complete."
echo "  App install and verification are manual:"
echo "    npm install"
echo "    npm run verify"
echo "    npm run dev"
echo "══════════════════════════════════════════"
echo ""
