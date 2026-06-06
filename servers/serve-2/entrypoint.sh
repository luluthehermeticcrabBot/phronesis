#!/bin/bash
# ───────────────────────────────────────────────────────────
# Phronesis serve-2 entrypoint
# Starts opencode serve with isolated data directory
# ───────────────────────────────────────────────────────────
set -e

export HOME=/data

mkdir -p /data/.local/share/opencode
mkdir -p /data/.opencode/skills

WORKSPACE="/workspace"

if [ ! -f "$WORKSPACE/opencode.json" ]; then
    echo "ERROR: /workspace/opencode.json not found."
    exit 1
fi

echo "=== Phronesis serve-2 ==="
echo "Data dir: /data"
echo "Workspace: $WORKSPACE"
echo "OpenCode version: $(opencode --version 2>&1)"

# Create symlinks so the workspace config's plugin paths work in container
# Workspace config uses file:///home/moritz/agent/repos/phronesis/src/<name>
# Container has plugins at /phronesis/src/<name>
# We symlink: /home/moritz/agent/repos/phronesis → /phronesis
mkdir -p /home/moritz/agent/repos
ln -sfn /phronesis /home/moritz/agent/repos/phronesis

cd "$WORKSPACE"

exec opencode serve \
    --port 4097 \
    --hostname 0.0.0.0 \
    --theme dark \
    --title "Phronesis serve-2"
