#!/bin/bash
set -e

# ── If arguments are provided, exec them directly (serve mode) ──
if [ $# -gt 0 ]; then
  exec "$@"
fi

# ── Otherwise, run the test suite ──
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Phronesis Plugin Test Suite            ║"
echo "║   OpenCode Adaptive Skills + Memory      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Environment Info ──
echo "🔧 Environment"
echo "  Node:    $(node --version)"
echo "  OpenCode: $(opencode --version 2>/dev/null || echo 'checking...')"
echo "  Workdir: $(pwd)"
echo "  Date:    $(date -u '+%Y-%m-%d %H:%M UTC')"
echo ""

# ── Setup test environment ──
export XDG_DATA_HOME="/tmp/test-data/xdg"
export XDG_CONFIG_HOME="/tmp/test-data/xdg-config"
export HOME="/tmp/test-home"
mkdir -p "$XDG_DATA_HOME/opencode" "$XDG_CONFIG_HOME/opencode" "$HOME"

# Create a minimal opencode.db for session-search tests
echo "🗄️  Creating test opencode.db..."
sqlite3 "$XDG_DATA_HOME/opencode/opencode.db" <<'SQL'
CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at TEXT,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES session(id),
    data TEXT
);
CREATE TABLE IF NOT EXISTS part (
    id TEXT PRIMARY KEY,
    message_id TEXT REFERENCES message(id),
    session_id TEXT,
    data TEXT
);
CREATE TABLE IF NOT EXISTS session_message (
    session_id TEXT,
    message_id TEXT
);

-- Insert test session data
INSERT INTO session (id, title) VALUES
    ('sess-001', 'fixing docker deployment'),
    ('sess-002', 'implementing auth middleware'),
    ('sess-003', 'database schema migration');

-- Messages for session 1 (docker)
INSERT INTO message (id, session_id, data) VALUES
    ('msg-001', 'sess-001', '{"role":"user"}'),
    ('msg-002', 'sess-001', '{"role":"assistant"}'),
    ('msg-003', 'sess-001', '{"role":"user"}'),
    ('msg-004', 'sess-001', '{"role":"assistant"}');
INSERT INTO part (id, message_id, session_id, data) VALUES
    ('part-001', 'msg-001', 'sess-001', '{"text":"Our Docker compose setup is failing with port conflicts because the web service binds to host port 80 which is already in use by the existing nginx container."}'),
    ('part-002', 'msg-002', 'sess-001', '{"text":"I checked the docker-compose.yml file. The web service has \\"80:80\\" for the host port mapping. We need to change it to a different port like 8080. Also, we should add a depends_on for the database service."}'),
    ('part-003', 'msg-003', 'sess-001', '{"text":"Good, that fixed the port conflict. But now the container cant connect to the database. What should I check?"}'),
    ('part-004', 'msg-004', 'sess-001', '{"text":"The issue is likely the database hostname. In Docker Compose, you should use the service name as the hostname. Check that your application config uses \\"db\\" as the database host instead of \\"localhost\\". Also verify that the database service has a healthcheck."}');

-- Messages for session 2 (auth)
INSERT INTO message (id, session_id, data) VALUES
    ('msg-005', 'sess-002', '{"role":"user"}'),
    ('msg-006', 'sess-002', '{"role":"assistant"}');
INSERT INTO part (id, message_id, session_id, data) VALUES
    ('part-005', 'msg-005', 'sess-002', '{"text":"I need to implement JWT authentication middleware for our Express API. It should verify tokens and attach user info to the request."}'),
    ('part-006', 'msg-006', 'sess-002', '{"text":"Here is the auth middleware implementation. We use jsonwebtoken to verify the Bearer token from the Authorization header. The decoded payload is attached to req.user. We also handle token expiration errors gracefully."}');

-- Messages for session 3 (database)
INSERT INTO message (id, session_id, data) VALUES
    ('msg-007', 'sess-003', '{"role":"user"}'),
    ('msg-008', 'sess-003', '{"role":"assistant"}');
INSERT INTO part (id, message_id, session_id, data) VALUES
    ('part-007', 'msg-003', 'sess-003', '{"text":"We need to migrate our database from SQLite to PostgreSQL. The schema uses Sequelize ORM which supports both."}'),
    ('part-008', 'msg-004', 'sess-003', '{"text":"To migrate from SQLite to PostgreSQL: 1) Update the Sequelize dialect in config. 2) Export SQLite data to JSON. 3) Update any dialect-specific queries. 4) Import into PostgreSQL. 5) Run the migrations. The main changes are in the connection config and any raw SQL queries."}');
SQL
echo "  ✅ Test DB created with 3 sessions"
echo ""

# ── Run the Node.js test suite ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Running Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node /test/tests/container/test.mjs

TEST_EXIT=$?

echo ""
if [ $TEST_EXIT -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed (exit code $TEST_EXIT)"
fi

exit $TEST_EXIT
