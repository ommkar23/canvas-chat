#!/usr/bin/env bash
set -euo pipefail

CANVAS_CHAT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REFERENCE_REPOS_DIR="${WORKSPACE_ROOT}/repos"
PI_MONO_DIR="${REFERENCE_REPOS_DIR}/pi-mono"
AGENT_BROWSER_REF_DIR="${REFERENCE_REPOS_DIR}/agent-browser"
PI_MONO_GIT_URL="${PI_MONO_GIT_URL:-https://github.com/badlogic/pi-mono.git}"
AGENT_BROWSER_GIT_URL="${AGENT_BROWSER_GIT_URL:-https://github.com/vercel-labs/agent-browser.git}"

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

# ── 2. image-installed CLIs ───────────────────────────────────────────────────
echo ""
echo "▶ Step 2/5 — installed CLIs"

if command -v codex &> /dev/null; then
  echo "  ✓ codex — $(codex --version 2>/dev/null || echo 'version unknown')"
else
  echo "  ✗ codex missing from PATH"
fi

if command -v pi &> /dev/null; then
  echo "  ✓ pi — $(pi --version 2>/dev/null || echo 'version unknown')"
else
  echo "  ✗ pi missing from PATH"
fi

if command -v agent-browser &> /dev/null; then
  echo "  ✓ agent-browser — $(agent-browser --version 2>/dev/null || echo 'version unknown')"
else
  echo "  ✗ agent-browser missing from PATH"
fi

# ── 3. app dependencies ───────────────────────────────────────────────────────
echo ""
echo "▶ Step 3/5 — app dependencies"
cd "${CANVAS_CHAT_DIR}"
pnpm install
echo "  ✓ dependencies installed"

# ── 4. agent-browser deps ─────────────────────────────────────────────────────
echo ""
echo "▶ Step 4/5 — agent-browser browser deps"
agent-browser install --with-deps
echo "  ✓ agent-browser browser deps installed"

# ── 5. app verification ───────────────────────────────────────────────────────
echo ""
echo "▶ Step 5/5 — app verification"
pnpm lint
pnpm run verify
pnpm build
echo "  ✓ lint, verify, and build passed"

echo ""
echo "══════════════════════════════════════════"
echo "  Setup complete."
echo "  Start the app with:"
echo "    pnpm dev"
echo "══════════════════════════════════════════"
echo ""
